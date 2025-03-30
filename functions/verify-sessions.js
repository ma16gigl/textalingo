const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { session_id } = event.queryStringParameters;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: session.payment_status || session.status,
        plan: session.metadata.plan || session.line_items.data[0].price.id.split('_')[1]
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};