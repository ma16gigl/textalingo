const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  try {
    const { language, category, title, episode = 1 } = JSON.parse(event.body);
    if (!language || !category) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Language and category are required' }),
      };
    }

    let prompt;
    if (category === 'Series') {
      prompt = episode === 1
        ? `Start a riveting text message conversation series in ${language} with English translations, titled "${title}", between two people in different locations. This is Episode 1 of a planned 15+ episode arc. Begin with a gripping, unique hook (e.g., a mysterious message, a sudden crisis—no generic intros) that sets up an ongoing, suspenseful narrative with rich characters and a world that can evolve over many episodes. Deliver 15 messages for this episode, using natural, casual texting with emojis in 3-5 messages for tone. Format each line as: Name; Foreign message; English translation; sent or received. Example: Mario; Ciao; Hello; received or Luigi; Come stai?; How are you?; sent. Use varied character names for each message.`
        : `Continue the text message conversation series in ${language} with English translations, titled "${title}", between two people in different locations. This is Episode ${episode} of a 15+ episode arc. Build on the previous episode’s events, escalating the ongoing narrative with new twists, character development, or stakes (no recap, assume continuity). Deliver 15 messages for this episode, using natural, casual texting with emojis in 3-5 messages for tone. Format each line as: Name; Foreign message; English translation; sent or received. Example: Mario; Ciao; Hello; received or Luigi; Come stai?; How are you?; sent. Use varied character names for each message.`;
    } else {
      prompt = category === 'Romance'
        ? `Create a realistic, engaging text message conversation in ${language} with English translations, depicting a romance story between two people in different locations over 15 messages. Start with a quirky, everyday moment (e.g., a playful argument about dinner—no clichés like "I miss you"). Develop a narrative with humor, light tension, or charm, ending with a witty twist or spark. Use natural, casual texting style with emojis in 3-5 messages. Format each line as: Name; Foreign message; English translation; sent or received. Example: Sofia; Hai scelto il vino sbagliato!; You picked the wrong wine!; sent or Luca; È quello che piace a te!; It’s the one you like!; received. Use varied character names for each message.`
        : `Create a compelling text message conversation in ${language} with English translations, themed around ${category}, between two people in different locations over 15 messages. Begin with a vivid, specific moment (e.g., an odd event—no generic greetings). Craft a story with momentum, ending with a twist or resolution. Use authentic, concise texting with emojis in 3-5 messages. Format each line as: Name; Foreign message; English translation; sent or received. Example: Ana; Qué es ese ruido?; What’s that noise?; received or Pedro; No sé, voy a mirar; I don’t know, I’ll check; sent. Use varied character names for each message.`;
    }

    console.log('Sending request to xAI API with prompt:', prompt);

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
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