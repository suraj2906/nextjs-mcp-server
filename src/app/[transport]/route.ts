import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";

interface CourseRecommendation {
  title: string;
  description: string;
  duration: string;
  prerequisites: string;
  topics: string[];
}

interface CourseRecommendations {
  beginner: CourseRecommendation;
  intermediate: CourseRecommendation;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

const courseRecommendations: CourseRecommendations = {
  beginner: {
    title: "Professional Javascript Fundamentals",
    description: "Perfect for beginners starting their web development journey. Covers JavaScript basics, DOM manipulation, and modern ES6+ features.",
    duration: "8-12 weeks",
    prerequisites: "Basic computer literacy",
    topics: ["Variables and Data Types", "Functions", "DOM Manipulation", "Async JavaScript", "Modern JavaScript Features"]
  },
  intermediate: {
    title: "Professional React/NextJs Development",
    description: "Ideal for developers with JavaScript experience ready to learn modern React and Next.js frameworks.",
    duration: "10-14 weeks", 
    prerequisites: "Solid JavaScript knowledge",
    topics: ["React Hooks", "State Management", "Next.js", "Server-Side Rendering", "API Integration"]
  }
};

// Helper function to format API responses intelligently
function formatApiResponse(data: unknown, url: string): string {
  try {
    // Handle different types of responses
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "**API Response:** Empty array returned.";
      }
      
      // Format array data
      const itemCount = data.length;
      const sample = data.slice(0, 3); // Show first 3 items as sample
      
      let formatted = `**API Response from ${url}:**\n\n`;
      formatted += `**Total Items:** ${itemCount}\n\n`;
      
      if (typeof data[0] === 'object' && data[0] !== null) {
        formatted += `**Sample Data:**\n`;
        sample.forEach((item, index) => {
          formatted += `\n**Item ${index + 1}:**\n`;
          if (typeof item === 'object' && item !== null) {
            Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
              formatted += `• **${key}:** ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
            });
          }
        });
        
        if (itemCount > 3) {
          formatted += `\n... and ${itemCount - 3} more items`;
        }
      } else {
        formatted += `**Items:** ${data.join(', ')}`;
      }
      
      return formatted;
    }
    
    if (typeof data === 'object' && data !== null) {
      let formatted = `**API Response from ${url}:**\n\n`;
      const dataObj = data as Record<string, unknown>;
      
      // Handle common API response patterns
      if (dataObj.error) {
        formatted += `**Error:** ${dataObj.error}\n`;
        if (dataObj.message) formatted += `**Message:** ${dataObj.message}\n`;
        return formatted;
      }
      
      if (dataObj.status || dataObj.success !== undefined) {
        formatted += `**Status:** ${dataObj.status || (dataObj.success ? 'Success' : 'Failed')}\n`;
      }
      
      // Format object properties
      Object.entries(dataObj).forEach(([key, value]) => {
        if (key === 'status' || key === 'success') return; // Already handled above
        
        formatted += `**${key.charAt(0).toUpperCase() + key.slice(1)}:** `;
        
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            formatted += `Array with ${value.length} items\n`;
            if (value.length > 0 && value.length <= 5) {
              value.forEach((item: unknown, idx: number) => {
                formatted += `  ${idx + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
              });
            }
          } else {
            formatted += `\n`;
            Object.entries(value as Record<string, unknown>).forEach(([subKey, subValue]) => {
              formatted += `  • **${subKey}:** ${typeof subValue === 'object' ? JSON.stringify(subValue) : subValue}\n`;
            });
          }
        } else {
          formatted += `${value}\n`;
        }
      });
      
      return formatted;
    }
    
    // Handle primitive responses
    return `**API Response from ${url}:**\n\n${data}`;
    
  } catch (error) {
    return `**API Response from ${url}:**\n\n${JSON.stringify(data, null, 2)}`;
  }
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "courseRecommender",
      "Provides detailed course recommendations based on the user's programming experience level. Call this tool once per request to get a complete recommendation.",
      {
        experienceLevel: z.enum(["beginner", "intermediate"], {
          description: "The user's current programming experience level"
        })
      },
      ({ experienceLevel }) => {
        const recommendation = courseRecommendations[experienceLevel];
        
        return {
          content: [
            {
              type: 'text',
              text: `## Course Recommendation: ${recommendation.title}

**Experience Level:** ${experienceLevel}

**Course Description:** ${recommendation.description}

**Duration:** ${recommendation.duration}

**Prerequisites:** ${recommendation.prerequisites}

**Key Topics Covered:**
${recommendation.topics.map(topic => `• ${topic}`).join('\n')}

**Why This Course:** This course is specifically designed for ${experienceLevel} level developers and will provide you with the skills needed to advance to the next level in your programming journey.

**Next Steps:** Enroll in this course and dedicate consistent time to practice the concepts covered. Don't forget to build projects to reinforce your learning!`
            }
          ]
        };
      }
    );

    server.tool(
      "fetchApi",
      "Fetch data from any API endpoint and format the response appropriately. Supports GET, POST, PUT, DELETE methods with optional headers and body.",
      {
        url: z.string({
          description: "The full URL of the API endpoint to fetch from"
        }),
        method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional().default("GET"),
        headers: z.record(z.string()).optional().describe("Optional HTTP headers as key-value pairs"),
        body: z.string().optional().describe("Optional request body (for POST, PUT, PATCH requests)")
      },
      async ({ url, method = "GET", headers = {}, body }) => {
        try {
          // Validate URL
          new URL(url); // This will throw if URL is invalid
          
          const fetchOptions: RequestInit = {
            method,
            headers: {
              'User-Agent': 'MCP-API-Fetcher/1.0',
              ...headers
            }
          };

          // Add body for methods that support it
          if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            fetchOptions.body = body;
            
            // Set content-type if not already specified
            const headersObj = fetchOptions.headers as Record<string, string>;
            if (!headersObj['Content-Type'] && !headersObj['content-type']) {
              headersObj['Content-Type'] = 'application/json';
            }
          }

          const response = await fetch(url, fetchOptions);
          
          // Handle different response types
          const contentType = response.headers.get('content-type') || '';
          let data: unknown;
          
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else if (contentType.includes('text/')) {
            data = await response.text();
          } else {
            // For other content types, try to get as text
            data = await response.text();
          }

          // Handle HTTP errors
          if (!response.ok) {
            return {
              content: [
                {
                  type: 'text',
                  text: `## API Request Failed

**URL:** ${url}
**Method:** ${method}
**Status:** ${response.status} ${response.statusText}

**Error Response:**
${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`
                }
              ]
            };
          }

          // Format successful response
          const formattedResponse = formatApiResponse(data, url);
          
          return {
            content: [
              {
                type: 'text',
                text: `## API Request Successful

**URL:** ${url}
**Method:** ${method}
**Status:** ${response.status} ${response.statusText}

${formattedResponse}`
              }
            ]
          };

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          const errorName = error instanceof Error ? error.name : 'Error';
          
          return {
            content: [
              {
                type: 'text',
                text: `## API Request Error

**URL:** ${url}
**Method:** ${method}
**Error:** ${errorMessage}

**Details:** ${errorName === 'TypeError' && errorMessage.includes('fetch') 
  ? 'Network error or invalid URL. Please check the URL and try again.' 
  : 'An unexpected error occurred while making the API request.'}`
              }
            ]
          };
        }
      }
    );
  },
  {
    capabilities: {
      tools: {
        courseRecommender: {
          description: "Provides comprehensive course recommendations based on experience level - call once per request"
        },
        fetchApi: {
          description: "Fetch data from any API endpoint with flexible HTTP methods and intelligent response formatting"
        }
      }
    }
  },
  {
    redisUrl: process.env.REDIS_URL,
    sseEndpoint: "/sse", 
    streamableHttpEndpoint: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };