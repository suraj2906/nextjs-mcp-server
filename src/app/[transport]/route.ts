import { createMcpHandler } from "@vercel/mcp-adapter";
import { z } from "zod";

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

const courseRecommendations = {
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
  },
  {
    capabilities: {
      tools: {
        courseRecommender: {
          description: "Provides comprehensive course recommendations based on experience level - call once per request"
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