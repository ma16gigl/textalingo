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

    const prompt = category === 'Romance'
      ? `Create a realistic, engaging text message conversation in ${language} with English translations, depicting a romance story between two people in different locations over 15 messages. Start with a quirky, everyday moment (e.g., a playful argument about dinner, a flirty misunderstanding—no clichés like "I miss you"). Develop a narrative with humor, light tension, or charm, ending with a witty twist or spark. Use natural, casual texting style with emojis in 3-5 messages. Format each line as: foreign sentence (English translation) received or sent, no quotes. Example: Hai preso il vino per stasera? (Did you grab the wine for tonight?) sent`
      : `Create a compelling text message conversation in ${language} with English translations, themed around ${category}, between two people in different locations over 15 messages. Begin with a vivid, specific moment (e.g., an odd event—no generic greetings). Craft a story with momentum, ending with a twist or resolution. Use authentic, concise texting with emojis in 3-5 messages. Format as: foreign sentence (English translation) received or sent, no quotes.`;

    console.log('Sending request to xAI API with prompt:', prompt);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok', // Default model as per xAI docs
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`xAI API failed: ${response.status} - ${errorText}`);
      throw new Error(`xAI API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('xAI API raw response:', JSON.stringify(data, null, 2));

    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('Invalid xAI API response: No choices found');
    }

    const storyText = data.choices[0].message.content.trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story: storyText }),
    };
  } catch (error) {
    console.error('Function error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};