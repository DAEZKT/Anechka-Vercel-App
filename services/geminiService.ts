
import { GoogleGenAI } from "@google/genai";
import { Product, CartItem } from "../types";

/**
 * ROBUST API KEY RETRIEVAL
 * Vercel/Vite requires env vars to start with VITE_ to be exposed to the browser.
 */
const getApiKey = (): string => {
  let key = '';
  
  try {
    // 1. Try Vite standard (Most likely for Vercel+React)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY || '';
    }
    
    // 2. Fallback to process.env (Next.js or older builds)
    if (!key && typeof process !== 'undefined' && process.env) {
      key = process.env.API_KEY || process.env.REACT_APP_API_KEY || '';
    }
  } catch (e) {
    console.warn("Error reading environment:", e);
  }

  return key ? key.trim() : '';
};

// --- LAZY & SAFE INITIALIZATION ---
let aiClient: GoogleGenAI | null = null;
const apiKey = getApiKey();

// Only instantiate if we have a valid-looking key to prevent "ApiError" crash on boot
if (apiKey && apiKey.length > 10) {
  try {
    console.log("Initializing Gemini AI Service...");
    aiClient = new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("CRITICAL: Failed to start Gemini Client. Check your API Key.", e);
    aiClient = null;
  }
} else {
  console.log("Gemini AI skipped: No valid 'VITE_API_KEY' found in environment.");
}

export const geminiService = {
  /**
   * Generates a persuasive sales pitch for a WhatsApp message based on the cart.
   */
  generateWhatsAppPitch: async (cart: CartItem[], customerName: string): Promise<string> => {
    if (!aiClient) {
      console.warn("AI Service not available. returning static text.");
      return `Hola ${customerName}, le comparto el detalle de su pedido.`;
    }

    const productList = cart.map(i => `${i.quantity}x ${i.name}`).join(', ');
    
    const prompt = `
      Actúa como un vendedor experto de la boutique "Tienda Anechka".
      El cliente ${customerName} está interesado en: ${productList}.
      Genera un mensaje corto, amable y persuasivo para enviar por WhatsApp. 
      Incluye emojis. El tono debe ser elegante pero cercano.
      No pongas saludos genéricos como "Estimado usuario", usa el nombre.
      Máximo 30 palabras.
    `;

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "¡Hola! Su pedido está listo.";
    } catch (error) {
      console.error("Gemini API Error during generation:", error);
      return `Hola ${customerName}, aquí está el resumen de su pedido: ${productList}.`;
    }
  },

  /**
   * Analyzes business data to provide insights.
   */
  analyzeProductTrends: async (products: Product[]): Promise<string> => {
    if (!aiClient) return "⚠️ IA no configurada. Agregue VITE_API_KEY en Vercel.";

    const dataContext = JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock_level, price: p.price })));
    
    const prompt = `
      Analiza este inventario JSON de una boutique de ropa: ${dataContext}.
      Identifica:
      1. Qué productos tienen stock crítico (menor a 10).
      2. Sugiere una estrategia de venta rápida para el producto más caro.
      Responde en formato Markdown, sé breve y directo (rol de Auditor/Gerente).
    `;

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
      return response.text || "No se pudo generar el análisis.";
    } catch (error) {
      console.error("Gemini Insight Error:", error);
      return "Error al conectar con el asistente IA.";
    }
  }
};
