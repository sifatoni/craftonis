import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInterviewScheduledEmail(params: {
  candidateEmail: string
  candidateName: string
  companyName: string
  interviewType: string
  scheduledAt: Date
  notes?: string
  interviewerName?: string
}) {
  const {
    candidateEmail,
    candidateName,
    companyName,
    interviewType,
    scheduledAt,
    notes,
    interviewerName,
  } = params

  const dateStr = new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  })

  const typeLabel = interviewType === 'TECHNICAL' ? 'Technical Interview'
    : interviewType === 'BEHAVIORAL' ? 'Behavioral Interview'
      : 'General Interview'

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'interviews@craftonis.com',
    to: candidateEmail,
    subject: `Interview Scheduled - ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #c41e3a; padding: 24px 32px;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Craftonis</h1>
          <p style="color: #fca5a5; margin: 4px 0 0 0; font-size: 13px;">HR Intelligence Platform</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #111827; margin: 0 0 8px 0;">Interview Invitation</h2>
          <p style="color: #6b7280; margin: 0 0 24px 0;">You have been invited for an interview at <strong style="color: #111827;">${companyName}</strong></p>

          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Candidate</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${candidateName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Company</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${companyName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Interview Type</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date & Time</td>
                <td style="padding: 8px 0; color: #c41e3a; font-size: 14px; font-weight: 700;">${dateStr} (BST)</td>
              </tr>
              ${interviewerName ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Interviewer</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${interviewerName}</td>
              </tr>` : ''}
              ${notes ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Notes</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${notes}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="color: #6b7280; font-size: 13px; margin: 0;">Please be available at the scheduled time. If you have any questions, please contact the HR team.</p>
        </div>
        <div style="background: #f3f4f6; padding: 16px 32px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">This email was sent via Craftonis - HR Intelligence Platform</p>
        </div>
      </div>
    `,
  })
}
