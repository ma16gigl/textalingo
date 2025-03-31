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
        prompt = `Generate a captivating text message conversation in ${language} with English translations, unfolding a romance story between two people in different locations across 15 messages. Start with an unexpected, flirty, or tender moment that sparks curiosity—no generic greetings. Build a plot with longing, a misunderstanding, or a secret, ending with a heartfelt revelation or reunion tease. Use casual, playful texting with emojis in 3-5 messages for charm or tension. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ti ho sognato stanotte 😏 (I dreamed of you last night 😏) sent`;
        break;
      case 'Thriller':
        prompt = `Generate a tense text message conversation in ${language} with English translations, unfolding a thriller story between two people in different locations across 15 messages. Begin with a cryptic or urgent message that hints at danger—no small talk. Escalate with clues, fear, or a chase, ending with a shocking twist or escape. Use short, panicked texting with emojis in 3-5 messages for urgency. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Dove sei? Qualcuno mi segue (Where are you? Someone’s following me) received`;
        break;
      case 'Horror':
        prompt = `Generate a chilling text message conversation in ${language} with English translations, unfolding a horror story between two people in different locations across 15 messages. Open with a creepy observation or plea that sets an eerie tone—no casual starts. Build dread with strange events or warnings, ending with a haunting reveal or silence. Use terse, fearful texting with emojis in 3-5 messages for terror. Format as: foreign sentence (English translation) received or sent, no quotes. Example: C’è un’ombra fuori dalla finestra (There’s a shadow outside my window) received`;
        break;
      case 'Action/Adventure':
        prompt = `Generate an adrenaline-pumping text message conversation in ${language} with English translations, unfolding an action/adventure story between two people in different locations across 15 messages. Kick off with a bold move or distress call that launches the action—no slow intros. Ramp up with daring plans or risks, ending with a triumph or narrow escape. Use fast, excited texting with emojis in 3-5 messages for energy. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ho appena rubato la chiave! (I just stole the key!) sent`;
        break;
      case 'SciFi':
        prompt = `Generate a mind-bending text message conversation in ${language} with English translations, unfolding a sci-fi story between two people in different locations across 15 messages. Start with a strange signal or discovery that defies reality—no mundane chit-chat. Unravel a futuristic puzzle or threat, ending with an otherworldly twist or question. Use curious, techy texting with emojis in 3-5 messages for awe or alarm. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Il drone ha captato qualcosa di strano (The drone picked up something weird) sent`;
        break;
      case 'Comedy':
        prompt = `Generate a hilarious text message conversation in ${language} with English translations, unfolding a comedy story between two people in different locations across 15 messages. Launch with an absurd mishap or witty jab that sets a goofy tone—no dull hellos. Pile on misunderstandings or chaos, ending with a laugh-out-loud punchline. Use silly, sarcastic texting with emojis in 3-5 messages for humor. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Ho chiuso il gatto in frigo per sbaglio 😂 (I locked the cat in the fridge by mistake 😂) sent`;
        break;
      case 'Business/Professional':
        prompt = `Generate a sharp text message conversation in ${language} with English translations, unfolding a business/professional story between two people in different locations across 15 messages. Begin with a high-stakes deal or glitch that demands attention—no generic opens. Develop a power play or crisis, ending with a clever win or fallout. Use brisk, witty texting with emojis in 3-5 messages for stress or swagger. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Il cliente ha appena annullato tutto (The client just canceled everything) received`;
        break;
      case 'Mystery':
        prompt = `Generate an intriguing text message conversation in ${language} with English translations, unfolding a mystery story between two people in different locations across 15 messages. Open with a puzzling question or odd event that hooks instantly—no slow starts. Deepen with cryptic hints or suspicion, ending with a revelation or new enigma. Use cautious, clever texting with emojis in 3-5 messages for intrigue. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Hai mai visto questa foto prima? (Have you ever seen this photo before?) sent`;
        break;
      default:
        prompt = `Generate an engaging text message conversation in ${language} with English translations, themed around ${category}, between two people in different locations across 15 messages. Start with a unique, attention-grabbing moment—no generic greetings. Build a story with tension or surprise, ending with a twist or resolution. Use natural, concise texting with emojis in 3-5 messages for tone. Format as: foreign sentence (English translation) received or sent, no quotes. Example: Sei sicuro di essere solo? (Are you sure you’re alone?) sent`;
    }

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
        temperature: 1.0,
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