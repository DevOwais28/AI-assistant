import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { mockProperties } from "../data/mockProperties";
import { Property } from "../types/property";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

const searchPropertiesFunction: FunctionDeclaration = {
  name: "searchProperties",
  description: "Search for properties based on location, type, price, and bedrooms.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      city: { type: Type.STRING, description: "The city to search in (e.g., Karachi, Lahore, Islamabad)" },
      area: { type: Type.STRING, description: "The specific area or neighborhood" },
      type: { type: Type.STRING, enum: ["apartment", "house", "commercial"], description: "The type of property" },
      maxPrice: { type: Type.NUMBER, description: "Maximum price in Lakhs" },
      minBedrooms: { type: Type.NUMBER, description: "Minimum number of bedrooms" },
    },
  },
};

export const searchProperties = (args: any): Property[] => {
  const { city, area, type, maxPrice, minBedrooms } = args;
  
  return mockProperties.filter(p => {
    if (city && p.location.city.toLowerCase() !== city.toLowerCase()) return false;
    if (area && !p.location.area.toLowerCase().includes(area.toLowerCase())) return false;
    if (type && p.type !== type) return false;
    if (maxPrice && p.price > maxPrice) return false;
    if (minBedrooms && (p.bedrooms || 0) < minBedrooms) return false;
    return true;
  });
};

export const getGeminiResponse = async (messages: { role: string; content: string }[]) => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are a professional property dealer AI assistant named EstateAI. Your job is to help users find properties based on their requirements. 

Rules:
1. Always answer politely and clearly.
2. If a property is available, give full details (location, type, price, bedrooms, availability, and any special features).
3. If no property matches the request, suggest alternatives nearby or similar types from the available data.
4. Use a friendly tone, like a helpful human agent.
5. Always confirm interest: "Would you like me to show more options in [area]?"
6. If asked about your services, respond: "I help clients find the best properties and give complete details about availability, price, and location."
7. Use the searchProperties tool to find real properties from our database. Do NOT make up properties that are not in the database.
8. If the user asks for something not in the database, tell them you don't have it but suggest the closest match.
9. Format your responses with Markdown for better readability.`;

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [searchPropertiesFunction] }],
    },
  });

  const functionCalls = response.functionCalls;
  if (functionCalls) {
    const results = functionCalls.map(call => {
      if (call.name === "searchProperties") {
        return {
          callId: call.id,
          name: call.name,
          response: { result: searchProperties(call.args) }
        };
      }
      return null;
    }).filter(Boolean);

    // Send function results back to model
    const secondResponse = await ai.models.generateContent({
      model,
      contents: [
        ...contents,
        { role: 'model', parts: response.candidates[0].content.parts },
        {
          role: 'user',
          parts: results.map(r => ({
            functionResponse: {
              name: r!.name,
              response: r!.response
            }
          }))
        }
      ],
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [searchPropertiesFunction] }],
      }
    });

    return {
      text: secondResponse.text || "I'm sorry, I couldn't find any properties matching that description.",
      properties: results[0]?.response.result as Property[]
    };
  }

  return {
    text: response.text || "I'm sorry, I couldn't process your request.",
    properties: []
  };
};
