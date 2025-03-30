const supabase = window.supabase.createClient(
    'https://uxvgqoskjjiwwvbpicrf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dmdxb3Nramppd3d2YnBpY3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0Mzk5OTMsImV4cCI6MjA1ODAxNTk5M30.cLhkued4GU774EhTotpFLAfGIH_iPDhVZp2CqRJxUq8'
);

async function signInWithEmail() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        console.error("Email sign-in error:", error.message);
        alert("Sign-in failed: " + error.message);
        return;
    }
    if (!data.user) {
        const { data: signupData, error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) {
            console.error("Sign-up error:", signupError.message);
            alert("Sign-up failed: " + signupError.message);
            return;
        }
        console.log("Signed up with email:", signupData.user);
    }
    console.log("Signed in user:", data.user.id);
    window.location.href = "index.html"; // Redirect back to main app
}

async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
    });
    if (error) {
        console.error("Google sign-in error:", error.message);
        alert("Google sign-in failed: " + error.message);
        return;
    }
    // OAuth will redirect, so no need for manual redirect here
}