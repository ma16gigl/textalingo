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

    const prompt = `Generate a gripping, realistic text message conversation in ${language} with English translations, themed around ${category}. The dialogue is between two people in different locations, unfolding in real-time across 15 messages. Craft a vivid, evolving story with a clear arc—start with a relatable hook, build tension or mystery through their exchange, and end with a satisfying twist, resolution, or cliffhanger. Make the characters distinct and emotionally invested, using casual, concise phrasing that feels like real texting. Add emojis in 3-5 messages where they amplify tone or stakes (e.g., excitement, worry, relief). Base the story on a unique, specific situation that shapes their dialogue (don’t state it explicitly in the messages). Format each line as: foreign sentence (English translation) received or sent, without quotes. Avoid vague or boring exchanges—every message should push the plot forward with wit, drama, or heart. Example: Ciao hai visto il mio messaggio ieri? (Hey, did you see my message yesterday?) sent`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 1.0, // Increased for more creative flair
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const storyText = data.choices[0].message.content.trim();

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