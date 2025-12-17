
import { GoogleGenAI, Type } from "@google/genai";
import { Student } from "../types";

export const parseStudentList = async (rawText: string): Promise<Student[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract a list of students from this text. Each student needs a unique ID, a Name, and if available, a parent's mobile phone number for SMS notifications. If an ID isn't present, generate a unique short slug. Format the output as a clean JSON list.
    
    Text:
    ${rawText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'Unique identifier for the student' },
            name: { type: Type.STRING, description: 'Full name of the student' },
            email: { type: Type.STRING, description: 'Email address if available' },
            parentContact: { type: Type.STRING, description: 'Parent phone number if available' },
          },
          required: ['id', 'name'],
        },
      },
    },
  });

  try {
    const data = JSON.parse(response.text || '[]');
    return data.map((s: any) => ({
      ...s,
      qrValue: `ATTENDANCE_ID:${s.id}`
    }));
  } catch (error) {
    console.error("Failed to parse student list:", error);
    return [];
  }
};
