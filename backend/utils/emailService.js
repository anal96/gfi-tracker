import nodemailer from 'nodemailer';
import path from 'path';
import process from 'process';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async ({ to, subject, html }) => {
  try {
    // Resolve path to the public logo file
    // Assumes running from backend root, so public is ../public
    const logoPath = path.join(process.cwd(), '../public/icon-192.png');

    const info = await transporter.sendMail({
      from: `"GFI Tracker" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments: [{
        filename: 'logo.png',
        path: logoPath,
        cid: 'logo' // same cid value as in the html img src
      }]
    });

    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    return null;
  }
};

const getEmailStyle = () => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      line-height: 1.6; 
      color: #1f2937; 
      margin: 0; 
      padding: 0; 
      background-color: #f3f4f6; 
      -webkit-font-smoothing: antialiased;
    }
    
    .wrapper {
      width: 100%;
      background-color: #f3f4f6;
      padding: 40px 0;
    }

    .container { 
      max-width: 560px; 
      margin: 0 auto; 
      background-color: #ffffff; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    
    .header { 
      background: #ffffff; 
      padding: 40px 40px 20px 40px; 
      text-align: center;
      border-bottom: 1px solid #f3f4f6;
    }
    
    .logo { 
      margin-bottom: 24px;
    }
    
    .logo img {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .header-title { 
      color: #111827; 
      margin: 0; 
      font-size: 24px; 
      font-weight: 700; 
      letter-spacing: -0.025em;
    }
    
    .content { 
      padding: 40px; 
    }
    
    .greeting { 
      font-size: 18px; 
      margin-bottom: 24px; 
      color: #374151; 
      font-weight: 500;
    }
    
    .message { 
      color: #4b5563; 
      font-size: 16px;
      margin-bottom: 32px; 
    }
    
    .highlight-box {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 32px;
    }
    
    .credential-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .credential-row:last-child {
      border-bottom: none;
    }
    
    .label {
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .value {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 15px;
      color: #111827;
      font-weight: 600;
      background: #ffffff;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    
    .otp-code {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.2em;
      color: #2563eb;
      text-align: center;
      display: block;
      margin: 24px 0;
      padding: 20px;
      background: #eff6ff;
      border-radius: 8px;
      border: 1px dashed #bfdbfe;
    }

    .warning-box {
      display: flex;
      align-items: flex-start;
      background-color: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      padding: 16px;
      margin-top: 32px;
    }
    
    .warning-icon {
      font-size: 18px;
      margin-right: 12px;
    }
    
    .warning-text {
      font-size: 14px;
      color: #be123c;
      margin: 0;
      line-height: 1.5;
    }
    
    .button-container { 
      text-align: center; 
      margin-top: 32px; 
    }
    
    .button { 
      background-color: #2563eb; 
      color: #ffffff !important; 
      padding: 14px 32px; 
      text-decoration: none; 
      border-radius: 6px; 
      font-weight: 600; 
      font-size: 16px;
      display: inline-block; 
      transition: background-color 0.2s; 
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); 
    }
    
    .button:hover {
      background-color: #1d4ed8;
    }
    
    .footer { 
      background-color: #f9fafb; 
      padding: 32px 40px; 
      text-align: center; 
      border-top: 1px solid #f3f4f6;
    }
    
    .footer-text { 
      color: #9ca3af; 
      font-size: 13px; 
      margin: 0 0 8px 0; 
    }
    
    .social-links { 
      margin-top: 16px; 
    }
    
    .social-link { 
      color: #6b7280; 
      text-decoration: none; 
      margin: 0 12px; 
      font-size: 13px; 
      font-weight: 500;
    }
    
    .social-link:hover {
      color: #2563eb;
    }

    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .content { padding: 24px !important; }
      .header { padding: 30px 20px !important; }
    }
  </style>
`;

const getLogoHtml = () => {
  return `
    <div class="logo">
      <img src="cid:logo" alt="GFI Tracker" width="64" height="64" style="display: block; margin: 0 auto; border-radius: 12px;">
    </div>
  `;
};

export const getWelcomeEmailTemplate = (name, email, password) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailStyle()}
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            ${getLogoHtml()}
            <h1 class="header-title">Welcome Aboard!</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hi ${name},</p>
            <p class="message">Your GFI Tracker account has been created successfully. We're thrilled to have you join us. Here are your temporary login credentials:</p>
            
            <div class="highlight-box">
              <div class="credential-row">
                <span class="label">Email</span>
                <span class="value">${email}</span>
              </div>
              <div class="credential-row">
                <span class="label">Password</span>
                <span class="value">${password}</span>
              </div>
            </div>

            <div class="warning-box">
              <span class="warning-icon">🛡️</span>
              <p class="warning-text">
                For your security, please log in and change this temporary password immediately.
              </p>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Log In to Dashboard</a>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">&copy; ${new Date().getFullYear()} GFI Tracker System. All rights reserved.</p>
            <div class="social-links">
              <a href="#" class="social-link">Privacy</a>
              <a href="#" class="social-link">Terms</a>
              <a href="#" class="social-link">Help Center</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getOtpEmailTemplate = (name, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailStyle()}
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            ${getLogoHtml()}
            <h1 class="header-title">Reset Your Password</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${name},</p>
            <p class="message">We received a request to reset the password for your GFI Tracker account. Use the code below to complete the process:</p>
            
            <div class="otp-code">${otp}</div>

            <p class="message" style="text-align: center; margin-bottom: 0;">
              This code will expire in <strong>10 minutes</strong>.
            </p>

            <div class="warning-box" style="background-color: #f9fafb; border-color: #e5e7eb; margin-top: 24px;">
              <span class="warning-icon">ℹ️</span>
              <p class="warning-text" style="color: #6b7280;">
                If you didn't ask to reset your password, you can safely ignore this email. Your account is secure.
              </p>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">&copy; ${new Date().getFullYear()} GFI Tracker System. All rights reserved.</p>
            <div class="social-links">
              <a href="#" class="social-link">Privacy</a>
              <a href="#" class="social-link">Terms</a>
              <a href="#" class="social-link">Help Center</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getAccountDeletionEmailTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${getEmailStyle()}
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            ${getLogoHtml()}
            <h1 class="header-title">Account Deleted</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hello ${name},</p>
            <p class="message">
              This email is to inform you that your GFI Tracker staff account has been <strong>permanently deleted</strong> by an administrator.
            </p>
            
            <div class="warning-box">
              <span class="warning-icon">⚠️</span>
              <p class="warning-text">
                You are no longer a member of the GFI Tracker staff. You will no longer be able to access the dashboard or any associated data.
              </p>
            </div>

            <p class="message" style="margin-top: 24px;">
              If you believe this was a mistake, please contact the administrator directly.
            </p>
          </div>

          <div class="footer">
            <p class="footer-text">&copy; ${new Date().getFullYear()} GFI Tracker System. All rights reserved.</p>
            <div class="social-links">
              <a href="#" class="social-link">Privacy</a>
              <a href="#" class="social-link">Terms</a>
              <a href="#" class="social-link">Help Center</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
