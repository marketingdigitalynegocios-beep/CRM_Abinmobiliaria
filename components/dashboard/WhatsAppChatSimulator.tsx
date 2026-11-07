"use client";

import { useState } from "react";

interface Message {
  id: string;
  sender: "client" | "agent";
  text: string;
  time: string;
}

function now() {
  return new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

const STARTER_MESSAGES: Message[] = [
  {
    id: "starter",
    sender: "client",
    text: "Hola, ¿qué propiedades tienen disponibles?",
    time: now(),
  },
];

export function WhatsAppChatSimulator() {
  const [messages, setMessages] = useState<Message[]>(STARTER_MESSAGES);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!inputMessage.trim() || isSending) return;

    const userText = inputMessage.trim();
    setInputMessage("");
    setError(null);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: "client", text: userText, time: now() },
    ]);
    setIsSending(true);

    try {
      const res = await fetch("/api/ai-agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };

      if (!res.ok || !data.reply) {
        setError(data.error ?? "No se pudo contactar al agente de IA.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "agent", text: data.reply!, time: now() },
      ]);
    } catch {
      setError("Error de red al contactar al agente de IA.");
    } finally {
      setIsSending(false);
    }
  }

  function handleReset() {
    setMessages(STARTER_MESSAGES);
    setError(null);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
      <div className="flex items-center justify-between bg-[#075e54] p-3 text-white">
        <div className="leading-tight">
          <div className="text-xs font-bold text-white">Simulador del Agente de IA</div>
          <div className="text-[10px] text-emerald-200 font-medium">
            Prueba real contra Gemini — usa tu inventario y prompt configurados
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20 transition-colors"
          title="Reiniciar chat de prueba"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          <span>Reiniciar</span>
        </button>
      </div>

      <div className="flex-1 space-y-3 bg-[#efeae2] p-4 min-h-[380px] max-h-[460px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "client" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`relative max-w-[85%] rounded-lg p-3 text-xs leading-relaxed shadow-xs whitespace-pre-wrap ${
                msg.sender === "client"
                  ? "rounded-tl-none bg-white text-slate-800"
                  : "rounded-tr-none bg-[#dcf8c6] text-slate-800"
              }`}
            >
              <p>{msg.text}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                <span>{msg.time}</span>
                {msg.sender === "agent" && (
                  <span className="material-symbols-outlined text-[13px] text-sky-600">
                    done_all
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-end">
            <div className="rounded-lg rounded-tr-none bg-[#dcf8c6] p-2.5 text-xs text-slate-500 italic flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-slate-200 bg-[#f0f2f5] p-2.5"
      >
        <input
          className="flex-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Simular mensaje de cliente en WhatsApp..."
          type="text"
          value={inputMessage}
        />
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884] text-white shadow-xs hover:bg-[#008f6f] disabled:opacity-50 transition-colors"
          disabled={!inputMessage.trim() || isSending}
          type="submit"
        >
          <span className="material-symbols-outlined text-[16px]">send</span>
        </button>
      </form>
    </div>
  );
}
