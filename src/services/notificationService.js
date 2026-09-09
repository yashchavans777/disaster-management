/**
 * Automated Early Warning Notification Service (SIH26002).
 * Integrates Twilio (SMS) and Nodemailer (SMTP Email) to automatically
 * alert district administrators and field workers during HIGH risk events.
 */

const nodemailer = require('nodemailer');
const twilio = require('twilio');
const logger = require('../utils/logger');

// ── Email Setup (Nodemailer) ──────────────────────────────────────────────────
/**
 * Creates and returns an SMTP transporter using credentials from environment variables.
 * Defaults to Gmail SMTP service unless custom host/port are configured.
 */
const getEmailTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    logger.warn(
      '[Nodemailer] EMAIL_USER or EMAIL_PASS not configured in .env. Early warning emails will run in simulation mode.'
    );
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user,
      pass,
    },
  });
};

// ── SMS Setup (Twilio) ────────────────────────────────────────────────────────
/**
 * Initializes and returns a Twilio client using credentials from environment variables.
 */
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    logger.warn(
      '[Twilio] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured in .env. Early warning SMS will run in simulation mode.'
    );
    return null;
  }

  try {
    return twilio(accountSid, authToken);
  } catch (err) {
    logger.error(`[Twilio Init Error] ${err.message}`);
    return null;
  }
};

/**
 * Sends concurrent Early Warning Alerts (SMS via Twilio and Email via Nodemailer)
 * when a HIGH risk level is detected by the AI route intelligence microservice.
 *
 * @param {string} location - Location name or coordinates string, e.g. "Silchar (24.8333, 92.7789)"
 * @param {string} riskLevel - Evaluated risk level ("HIGH", "MODERATE", "LOW")
 * @param {string} hazardDetails - Description of hazard, e.g. "Severe Flash Flooding & Landslide Threat"
 * @param {string} [recipientPhone] - Destination phone number for SMS alert
 * @param {string} [recipientEmail] - Destination email address for early warning bulletin
 * @returns {Promise<{ sms: object, email: object, dispatched: boolean }>}
 */
const sendEarlyWarningAlert = async (
  location,
  riskLevel,
  hazardDetails,
  recipientPhone,
  recipientEmail
) => {
  const normalizedRisk = String(riskLevel || '').trim().toUpperCase();

  // Alert triggers strictly when riskLevel is "HIGH"
  if (normalizedRisk !== 'HIGH') {
    logger.debug(
      `[Early Warning] Skipped alert dispatch: Risk level is "${riskLevel}", not "HIGH".`
    );
    return { dispatched: false, reason: 'Risk level is not HIGH' };
  }

  const targetLocation = location || 'North East Region (NER) Sector';
  const targetHazard = hazardDetails || 'Imminent Flash Flood / Landslide Disruption';
  const targetPhone =
    recipientPhone ||
    process.env.ADMIN_PHONE ||
    process.env.RECIPIENT_PHONE ||
    '+919876543210';
  const targetEmail =
    recipientEmail ||
    process.env.ADMIN_EMAIL ||
    process.env.RECIPIENT_EMAIL ||
    'district.admin@sih26002.gov.in';

  // Exact required Early Warning message specification:
  // "🚨 URGENT ALERT: HIGH Risk detected at {location}. Hazard: {hazardDetails}. Please initiate immediate preventive measures."
  const alertMessage = `🚨 URGENT ALERT: HIGH Risk detected at ${targetLocation}. Hazard: ${targetHazard}. Please initiate immediate preventive measures.`;

  logger.info(
    `[Early Warning Initiated] Dispatching HIGH risk early warning to Phone: ${targetPhone} & Email: ${targetEmail}`
  );

  // ── 1. Twilio SMS Dispatch Task ─────────────────────────────────────────────
  const dispatchSms = async () => {
    try {
      const client = getTwilioClient();
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (client && fromNumber) {
        const message = await client.messages.create({
          body: alertMessage,
          from: fromNumber,
          to: targetPhone,
        });

        logger.info(
          `[Twilio SMS Sent] Early warning successfully delivered to ${targetPhone} (SID: ${message.sid})`
        );
        return { status: 'sent', provider: 'twilio', sid: message.sid, to: targetPhone };
      }

      // Simulated SMS delivery for local sandbox and development environments
      logger.info(
        `[Twilio SMS Simulation] To: ${targetPhone} | Content: "${alertMessage}"`
      );
      return { status: 'simulated', provider: 'twilio-mock', to: targetPhone, note: 'Twilio credentials not set; alert logged.' };
    } catch (smsError) {
      // Catch Twilio rate limits (code 20429), unverified caller IDs (code 21608), or auth errors
      logger.error(
        `[Twilio SMS Error] Failed to send SMS to ${targetPhone}: ${smsError.message} (Code: ${smsError.code || 'N/A'})`
      );
      return { status: 'failed', provider: 'twilio', error: smsError.message, code: smsError.code };
    }
  };

  // ── 2. Nodemailer Email Dispatch Task ───────────────────────────────────────
  const dispatchEmail = async () => {
    try {
      const transporter = getEmailTransporter();
      const senderEmail = process.env.EMAIL_USER || 'alerts@sih26002-disaster.gov.in';

      if (transporter) {
        const mailOptions = {
          from: `"SIH26002 Early Warning Center" <${senderEmail}>`,
          to: targetEmail,
          subject: `🚨 URGENT EARLY WARNING: HIGH Risk Detected at ${targetLocation}`,
          text: alertMessage,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 2px solid #dc2626; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
              <div style="background: linear-gradient(135deg, #b91c1c, #dc2626); color: #ffffff; padding: 20px 24px;">
                <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">
                  🚨 SIH26002 AUTOMATED EARLY WARNING SYSTEM
                </h1>
                <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">
                  North East Region (NER) Relief Logistics & Hazard Coordination Command
                </p>
              </div>
              <div style="padding: 24px; background-color: #fef2f2; border-bottom: 1px solid #fee2e2;">
                <div style="background-color: #ffffff; border-left: 4px solid #dc2626; padding: 14px 16px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <p style="margin: 0; font-size: 15px; font-weight: bold; color: #991b1b; line-height: 1.6;">
                    ${alertMessage}
                  </p>
                </div>
              </div>
              <div style="padding: 24px; background-color: #ffffff;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">
                  Hazard Incident Intelligence
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #1e293b;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 8px 0; font-weight: 600; width: 140px; color: #64748b;">Target Location:</td>
                    <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${targetLocation}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Assessed Risk:</td>
                    <td style="padding: 8px 0;">
                      <span style="background-color: #dc2626; color: #ffffff; padding: 2px 8px; border-radius: 9999px; font-weight: 800; font-size: 11px;">
                        HIGH RISK
                      </span>
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Hazard Assessment:</td>
                    <td style="padding: 8px 0; color: #334155;">${targetHazard}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #64748b;">Timestamp:</td>
                    <td style="padding: 8px 0; color: #64748b; font-family: monospace;">${new Date().toISOString()}</td>
                  </tr>
                </table>
                <div style="margin-top: 24px; padding: 12px; background-color: #f8fafc; border-radius: 8px; font-size: 12px; color: #64748b; text-align: center;">
                  ⚠️ Automated bulletin generated by AI Route Intelligence Microservice. Action required immediately.
                </div>
              </div>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(
          `[Nodemailer Sent] Early warning email delivered to ${targetEmail} (ID: ${info.messageId})`
        );
        return { status: 'sent', provider: 'nodemailer', messageId: info.messageId, to: targetEmail };
      }

      // Simulated Email delivery for local sandbox and development environments
      logger.info(
        `[Nodemailer Simulation] To: ${targetEmail} | Subject: "🚨 URGENT EARLY WARNING: HIGH Risk Detected at ${targetLocation}"`
      );
      return { status: 'simulated', provider: 'nodemailer-mock', to: targetEmail, note: 'Email credentials not set; alert logged.' };
    } catch (emailError) {
      logger.error(
        `[Nodemailer Error] Failed to send email to ${targetEmail}: ${emailError.message}`
      );
      return { status: 'failed', provider: 'nodemailer', error: emailError.message };
    }
  };

  // Dispatch both SMS and Email concurrently using Promise.all
  try {
    const [smsResult, emailResult] = await Promise.all([
      dispatchSms(),
      dispatchEmail(),
    ]);

    return {
      dispatched: true,
      location: targetLocation,
      riskLevel: 'HIGH',
      hazardDetails: targetHazard,
      sms: smsResult,
      email: emailResult,
    };
  } catch (err) {
    logger.error(`[Early Warning Unexpected Error] ${err.message}`);
    return {
      dispatched: false,
      error: err.message,
    };
  }
};

module.exports = {
  sendEarlyWarningAlert,
  getEmailTransporter,
  getTwilioClient,
};
