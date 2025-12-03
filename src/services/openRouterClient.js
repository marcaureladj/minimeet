const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const generateMeetingSummary = async (transcript, meetingInfo = {}) => {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Clé API OpenRouter non configurée');
  }

  const systemPrompt = `Tu es un assistant spécialisé dans l'analyse de réunions professionnelles. 
Tu dois analyser la transcription fournie et retourner UNIQUEMENT un objet JSON valide avec cette structure exacte:

{
  "summary": "Résumé général de la réunion en 2-3 phrases",
  "key_points": ["Point clé 1", "Point clé 2", "Point clé 3"],
  "decisions": ["Décision 1", "Décision 2"],
  "action_items": [
    {
      "task": "Description de la tâche",
      "assignee": "Nom de la personne responsable ou null si non mentionné",
      "priority": "high|medium|low",
      "deadline": "Date limite si mentionnée ou null"
    }
  ],
  "next_steps": ["Prochaine étape 1", "Prochaine étape 2"]
}

IMPORTANT: 
- Retourne UNIQUEMENT le JSON, sans texte avant ou après
- Utilise des guillemets doubles pour les clés et valeurs
- Si une section est vide, utilise un tableau vide []
- Sois concis mais précis
- Extrais les informations factuelles de la transcription`;

  const userPrompt = `Voici la transcription d'une réunion${meetingInfo.title ? ` intitulée "${meetingInfo.title}"` : ''}${meetingInfo.duration ? ` d'une durée de ${meetingInfo.duration}` : ''}:

---
${transcript}
---

Analyse cette transcription et génère le résumé structuré en JSON.`;

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
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erreur API: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || '{}';

    // Parser le JSON retourné
    return parseAISummary(rawContent);
  } catch (error) {
    console.error('Erreur OpenRouter:', error);
    throw error;
  }
};

/**
 * Parse la réponse de l'IA et extrait le JSON structuré
 * @param {string} rawText - Texte brut retourné par l'IA
 * @returns {Object} Objet avec summary, key_points, decisions, action_items, next_steps
 */
export const parseAISummary = (rawText) => {
  try {
    // Nettoyer le texte (enlever les backticks markdown si présents)
    let cleanText = rawText.trim();
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');

    // Extraire le JSON (chercher entre accolades)
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Valider et normaliser la structure
      return {
        summary: parsed.summary || 'Aucun résumé disponible',
        key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items.map(item => ({
          task: item.task || '',
          assignee: item.assignee || null,
          priority: item.priority || 'medium',
          deadline: item.deadline || null
        })) : [],
        next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps : []
      };
    }

    // Fallback: si pas de JSON valide, retourner le texte brut comme résumé
    console.warn('Impossible de parser le JSON, utilisation du texte brut');
    return {
      summary: rawText,
      key_points: [],
      decisions: [],
      action_items: [],
      next_steps: []
    };
  } catch (error) {
    console.error('Erreur lors du parsing du résumé:', error);
    return {
      summary: rawText || 'Erreur lors de la génération du résumé',
      key_points: [],
      decisions: [],
      action_items: [],
      next_steps: []
    };
  }
};

export const transcribeWithAI = async (audioBlob) => {
  // Note: OpenRouter ne supporte pas directement la transcription audio
  // Cette fonction est un placeholder pour une future intégration
  // avec un service de transcription comme Whisper API
  console.log('Transcription audio non implémentée - utiliser Web Speech API côté client');
  return null;
};
