require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  console.log('Testing Resend with:');
  console.log('API Key:', process.env.RESEND_API_KEY ? 'Present' : 'Missing');
  console.log('From Email:', process.env.FROM_EMAIL);
  
  try {
    const { data, error } = await resend.emails.send({
      from: `Test <${process.env.FROM_EMAIL}>`,
      to: ['shreyan@bharatmodules.com'], // Sending to the team email as a test
      subject: 'Resend API Test',
      html: '<p>If you see this, the Resend API is working correctly.</p>'
    });

    if (error) {
      console.error('Resend Error:', error);
    } else {
      console.log('Resend Success! ID:', data.id);
    }
  } catch (err) {
    console.error('Unexpected Error:', err.message);
  }
}

test();
