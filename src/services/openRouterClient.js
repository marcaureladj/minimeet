const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const generateMeetingSummary = async (transcript, meetingInfo = {}) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Clé API OpenRouter non configurée');
  }

  const systemPrompt = `Tu es un assistant spécialisé dans la création de résumés de réunions professionnelles. 
Tu dois analyser la transcription fournie et produire un résumé structuré en français comprenant:
1. Les points clés discutés
2. Les décisions prises
3. Les actions à entreprendre (avec responsables si mentionnés)
4. Les prochaines étapes

Sois concis mais complet. Utilise des puces pour la lisibilité.`;

  const userPrompt = `Voici la transcription d'une réunion${meetingInfo.title ? ` intitulée "${meetingInfo.title}"` : ''}${meetingInfo.duration ? ` d'une durée de ${meetingInfo.duration}` : ''}:

---
${transcript}
---

Génère un résumé structuré de cette réunion.`;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'MiniMeet'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Impossible de générer le résumé.';
  } catch (error) {
    console.error('Erreur OpenRouter:', error);
    throw error;
  }
};

export const transcribeWithAI = async (audioBlob) => {
  // Note: OpenRouter ne supporte pas directement la transcription audio
  // Cette fonction est un placeholder pour une future intégration
  // avec un service de transcription comme Whisper API
  console.log('Transcription audio non implémentée - utiliser Web Speech API côté client');
  return null;
};
