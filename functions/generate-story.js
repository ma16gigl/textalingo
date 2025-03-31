// Force redeploy to ensure latest version - 2025-03-30
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

    const prompt = `Generate a completely unique, highly creative, and engaging ${category} themed text message story in ${language} with English translations. The story must be a realistic text messaging dialogue between two people who are not in the same location (e.g., one is at home, the other is traveling), set in a specific and imaginative context (e.g., a bustling market, a mysterious forest, a futuristic city). It should consist of at least 30 messages. Format each line as: foreign sentence (English translation) received or sent, with no quotation marks around the entire line (since people don’t use quotes when texting). Do not include numbers or character names before each sentence. Use spaces or other punctuation within the foreign sentence and English translation, but do not use parentheses within them; reserve parentheses only for separating the English translation. Avoid bland or generic exchanges; make the dialogue dynamic, emotional, and full of surprises to captivate the reader. Example: Ciao ti ho visto al mercato oggi ma eri lontano (Hello I saw you at the market today but you were far away) sent`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
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