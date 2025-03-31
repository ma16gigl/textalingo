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
      // Add other cases as needed (omitted for brevity)
      default:
        prompt = `Create a compelling text message conversation in ${language} with English translations, themed around ${category}, between two people in different locations over 15 messages. Begin with a vivid, specific moment (e.g., an odd event or urgent need—no generic greetings). Craft a story with momentum, ending with a surprising twist or resolution. Use authentic, concise texting with emojis in 3-5 messages for flavor. Format as: foreign sentence (English translation) received or sent, no quotes.`;
    }

    const response = await fetch('https://api.xai.com/v1/completions', { // Replace with actual xAI endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok',
        prompt: prompt,
        max_tokens: 1000,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`xAI API request failed: ${response.status} - ${errorText}`);
      throw new Error(`xAI API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('xAI API response:', JSON.stringify(data, null, 2)); // Log raw response for debugging

    // Check if data and choices exist
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('Invalid xAI API response: No choices found');
    }

    const storyText = data.choices[0].text.trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story: storyText }),
    };
  } catch (error) {
    console.error('Error in generate-story:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};