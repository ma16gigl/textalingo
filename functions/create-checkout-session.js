const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    console.log('Function invoked with event:', event);
    const { plan } = JSON.parse(event.body);
    console.log(`Creating checkout session for plan: ${plan}`);

    const priceIds = {
      monthly: 'price_1R8UqgBTl8yPkrndsJ5UGyof', // Replace with your actual Monthly Price ID
      annual: 'price_1R8UrBBTl8yPkrndNpRkebCn',  // Replace with your actual Annual Price ID
      lifetime: 'price_1R8UrgBTl8yPkrndcNiCF4ZY' // Replace with your actual Lifetime Price ID
    };

    if (!priceIds[plan]) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const mode = plan === 'lifetime' ? 'payment' : 'subscription';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceIds[plan],
        quantity: 1,
      }],
      mode: mode,
      success_url: `${process.env.URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/getpremium.html`,
      metadata: { user_id: event.headers['x-user-id'] || 'anonymous' }
    });

    console.log(`Checkout session created with ID: ${session.id}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    console.error('Error in function:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};