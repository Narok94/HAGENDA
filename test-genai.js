import { GoogleGenAI } from "@google/genai";
try {
  const ai = new GoogleGenAI({ apiKey: undefined });
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}
