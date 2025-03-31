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

    const prompt = `Generate a highly engaging, realistic text message conversation in ${language} with English translations, themed around ${category}. The dialogue is between two people in different locations (e.g., one at home, one away), unfolding in real-time with 15 messages. Each message should feel natural, concise, and conversational, like actual texts—use casual phrasing, emotions, interruptions, or surprises to keep it dynamic. Include a specific, unique context that shapes the exchange (avoid generic settings), but don’t mention the context explicitly in the messages. Occasionally (in about 3-5 messages), add emojis where they naturally fit to reflect tone or emotion, as people do in real texting. Format each line as: foreign sentence (English translation) received or sent, without quotes around the line. Avoid dull or predictable exchanges; make the story gripping and believable. Example: Ciao sei in ritardo 😅 (Hey you’re late 😅) sent`;

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
        temperature: 0.9,
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