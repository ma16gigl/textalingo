const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    try {
        const { userId } = JSON.parse(event.body);
        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "User ID is required" })
            };
        }

        // Fetch the user's subscription from your database
        const response = await fetch(`https://uxvgqoskjjiwwvbpicrf.supabase.co/rest/v1/user_subscriptions?user_id=eq.${userId}&select=plan`, {
            headers: {
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dmdxb3Nramppd3d2YnBpY3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mzk5OTMsImV4cCI6MjA1ODAxNTk5M30.cLhkued4GU774EhTotpFLAfGIH_iPDhVZp2CqRJxUq8`,
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dmdxb3Nramppd3d2YnBpY3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mzk5OTMsImV4cCI6MjA1ODAxNTk5M30.cLhkued4GU774EhTotpFLAfGIH_iPDhVZp2CqRJxUq8'
            }
        });
        const subData = await response.json();
        if (!subData || subData.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "No active subscription found" })
            };
        }

        // For simplicity, assume Stripe Customer ID is stored or linked; here we simulate cancellation
        // In practice, you'd fetch the Stripe Subscription ID from your DB or Stripe
        const stripeSubId = "sub_example"; // Replace with logic to get real Subscription ID
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Subscription canceled successfully" })
        };
    } catch (error) {
        console.error('Error canceling subscription:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};