import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import knowledgeBase from "../data/knowledge_base.json";
import assistantConfig from "../data/assistant_config.json";
import { Property } from "../types/property";

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  // Vite define replacement
  try {
    return (process.env as any).GEMINI_API_KEY || "";
  } catch {
    return "";
  }
};

const apiKey = getApiKey();
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
  const properties = knowledgeBase.properties as Property[];
  
  return properties.filter(p => {
    if (city && p.location.city.toLowerCase() !== city.toLowerCase()) return false;
    if (area && !p.location.area.toLowerCase().includes(area.toLowerCase())) return false;
    if (type && p.type !== type) return false;
    if (maxPrice && p.price > maxPrice) return false;
    if (minBedrooms && (p.bedrooms || 0) < minBedrooms) return false;
    return true;
  });
};

export const getGeminiResponse = async (messages: { role: string; content: string }[]) => {
  const model = "gemini-3.1-flash-lite-preview";
  
  const config = assistantConfig.assistant;
  const systemInstruction = `${config.system_instructions}\n\nRules:\n${config.rules.join('\n')}\n\nKnowledge Base Context: Use the searchProperties tool to access real-time property data from our database.`;

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
