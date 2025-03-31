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

    const prompt = `Generate a unique, creative, and engaging ${category} themed text message story in ${language} with English translations. The story should be a realistic text messaging dialogue between two people not in the same location (e.g., one at home, the other traveling), set in an imaginative context (e.g., a market, a forest). It should have 15 messages. Format each line as: foreign sentence (English translation) received or sent, without quotes around the line. Avoid bland exchanges; make it dynamic and emotional. Example: Ciao ti ho visto al mercato oggi (I saw you at the market today) sent`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Faster than gpt-4-turbo-preview
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000, // Reduced from 3000
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