const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  try {
    const { language, category } = JSON.parse(event.body);
    if (!language || !category) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Language and category are required' }),
      };
    }

    let prompt;
    switch (category) {
      case 'Romance':
        prompt = `Create a realistic, engaging text message conversation in ${language} with English translations, depicting a romance story between two people in different locations over 15 messages. Start with a quirky, everyday moment (e.g., a playful argument about dinner, a flirty misunderstanding, or a spontaneous romantic idea—no clichés like "I miss you"). Develop a narrative with humor, light tension, or charm, ending with a witty twist, reconciliation, or spark. Use natural, casual texting style with emojis in 3-5 messages for tone (e.g., flirtation, sass). Format each line as: foreign sentence (English translation) received or sent, no quotes. Example: Hai preso il vino per stasera? (Did you grab the wine for tonight?) sent`;
        break;
      case 'Thriller':
        prompt = `Create a gripping text message conversation in ${language} with English translations, unfolding a thriller story between two people in different locations over 15 messages. Begin with an urgent, mysterious message (e.g., a warning or odd sighting—no small talk). Build suspense with clues or danger, ending with a shocking twist or cliffhanger. Use short, tense texting with emojis in 3-5 messages for urgency. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ti stanno cercando (They’re looking for you) received`;
        break;
      case 'Horror':
        prompt = `Create a creepy text message conversation in ${language} with English translations, unfolding a horror story between two people in different locations over 15 messages. Start with an unsettling event (e.g., a noise or figure spotted—no casual intros). Escalate with eerie details, ending with a terrifying reveal or silence. Use brief, panicked texting with emojis in 3-5 messages for dread. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Qualcosa si muove al buio (Something’s moving in the dark) received`;
        break;
      case 'Action/Adventure':
        prompt = `Create an exciting text message conversation in ${language} with English translations, unfolding an action/adventure story between two people in different locations over 15 messages. Kick off with a bold action (e.g., a heist or escape—no slow starts). Heighten with risks or plans, ending with a victory or close call. Use fast-paced, energetic texting with emojis in 3-5 messages for thrill. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ho il pacco, corro! (Got the package, running!) sent`;
        break;
      case 'SciFi':
        prompt = `Create a thought-provoking text message conversation in ${language} with English translations, unfolding a sci-fi story between two people in different locations over 15 messages. Begin with an anomalous event (e.g., a glitch or signal—no chit-chat). Unfold a futuristic mystery, ending with a mind-bending twist or question. Use curious, tech-savvy texting with emojis in 3-5 messages for wonder. Format as: foreign sentence (English translation) received or sent, no quotes. Example: La rete sta inviando dati strani (The network’s sending weird data) sent`;
        break;
      case 'Comedy':
        prompt = `Create a funny text message conversation in ${language} with English translations, unfolding a comedy story between two people in different locations over 15 messages. Start with a ridiculous mishap (e.g., a pet blunder or silly fight—no dull hellos). Stack up absurdities, ending with a hilarious punchline. Use playful, sarcastic texting with emojis in 3-5 messages for laughs. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ho dato fuoco alla torta 😂 (I set the cake on fire 😂) sent`;
        break;
      case 'Business/Professional':
        prompt = `Create a dynamic text message conversation in ${language} with English translations, unfolding a business story between two people in different locations over 15 messages. Open with a critical work issue (e.g., a deal collapsing—no generic opens). Advance with strategy or stress, ending with a smart fix or bust. Use sharp, professional texting with emojis in 3-5 messages for tone. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Il capo vuole tutto ora (The boss wants everything now) received`;
        break;
      case 'Mystery':
        prompt = `Create an intriguing text message conversation in ${language} with English translations, unfolding a mystery story between two people in different locations over 15 messages. Start with a strange clue (e.g., a found object—no slow intros). Deepen with questions or suspicion, ending with a reveal or new puzzle. Use sly, inquisitive texting with emojis in 3-5 messages for intrigue. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Questo non è il mio telefono (This isn’t my phone) sent`;
        break;
      default:
        prompt = `Create a compelling text message conversation in ${language} with English translations, themed around ${category}, between two people in different locations over 15 messages. Begin with a vivid, specific moment (e.g., an odd event or urgent need—no generic greetings). Craft a story with momentum, ending with a surprising twist or resolution. Use authentic, concise texting with emojis in 3-5 messages for flavor. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ho trovato qualcosa di tuo (I found something of yours) received`;
    }

    // Assuming xAI API endpoint and structure (adjust based on actual docs)
    const response = await fetch('https://api.xai.com/v1/completions', { // Replace with actual xAI endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok', // Assuming 'grok' is the model name
        prompt: prompt,
        max_tokens: 1000,
        temperature: 0.9, // Slightly lower for more coherent, realistic output
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const storyText = data.choices[0].text.trim(); // Adjust based on xAI response structure

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story: storyText }),
    };
  } catch (error) {
    console.error('Error generating story:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};