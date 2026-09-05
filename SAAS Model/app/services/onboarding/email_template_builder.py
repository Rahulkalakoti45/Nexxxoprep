from dataclasses import dataclass
from html import escape


@dataclass
class EmailTemplateContext:
    candidate_name: str
    position_name: str
    resume_score: float
    shortlist_reasons: list[str]
    interview_topics: list[str]
    interview_instructions: list[str]
    interview_url: str
    link_expiry: str
    company_name: str
    recruiter_contact: str
    skills: list[str] | None = None
    interview_mode: str | None = None
    interview_duration: str | None = None


class EmailTemplateBuilder:
    DEFAULT_INSTRUCTIONS = [
        "Stable internet connection",
        "Laptop/Desktop preferred",
        "Complete in one sitting",
        "Keep microphone ready",
        "Quiet environment",
        "Resume ready",
    ]

    def build(self, context: EmailTemplateContext) -> tuple[str, str, str]:
        if context.position_name:
            subject = f"Interview Invitation | {context.position_name} | {context.company_name or 'Intelligent Candidate Discovery'}"
        else:
            subject = f"Interview Invitation | {context.company_name or 'Intelligent Candidate Discovery'}"
        html_body = self._render_html(context)
        plain_body = self._render_plain(context)
        return subject, html_body, plain_body

    def _render_html(self, context: EmailTemplateContext) -> str:
        candidate_name = escape(context.candidate_name)
        company_name = escape(context.company_name or "Intelligent Candidate Discovery")
        interview_url = escape(context.interview_url)
        link_expiry = escape(context.link_expiry)
        recruiter_contact = escape(context.recruiter_contact or "recruiter@example.com")

        if context.position_name:
            position_name = escape(context.position_name)
            header_subtext = f"You have been shortlisted for the position of <strong>{position_name}</strong> at {company_name}."
            position_row = f"""
                      <!-- Position Row -->
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #475569;">Position</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 600; color: #0F172A; text-align: right;">{position_name}</td>
                      </tr>
            """
        else:
            header_subtext = f"You have been shortlisted at {company_name}."
            position_row = ""

        # Optional Interview Mode
        if context.interview_mode:
            mode_row = f"""
                      <!-- Interview Mode Row -->
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #475569;">Interview Mode</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 600; color: #0F172A; text-align: right;">{escape(context.interview_mode)}</td>
                      </tr>
            """
        else:
            mode_row = ""

        # Optional Interview Duration
        if context.interview_duration:
            duration_row = f"""
                      <!-- Interview Duration Row -->
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #475569;">Interview Duration</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 600; color: #0F172A; text-align: right;">{escape(context.interview_duration)}</td>
                      </tr>
            """
        else:
            duration_row = ""

        # Section 2: Skills Matched
        skills = getattr(context, "skills", None) or []
        if skills:
            skills_badges = "".join(
                f'<span style="display: inline-block; background-color: #EFF6FF; color: #1E40AF; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; margin: 4px 4px 4px 0; border: 1px solid #BFDBFE;">{escape(s)}</span>'
                for s in skills
            )
            skills_section = f"""
              <!-- Section 2: Skills Matched -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #1E3A8A; margin-bottom: 12px;">
                      Skills Matched
                    </div>
                    <div style="margin-top: 4px;">
                      {skills_badges}
                    </div>
                  </td>
                </tr>
              </table>
            """
        else:
            skills_section = ""

        # Section 3: Why You Were Shortlisted
        shortlist_reasons = context.shortlist_reasons or []
        if shortlist_reasons:
            reasons_rows = "".join(
                f"""
                      <tr>
                        <td valign="top" width="24" style="color: #2563EB; font-size: 14px; padding-bottom: 8px; font-weight: bold;">✔</td>
                        <td style="font-size: 14px; color: #334155; line-height: 20px; padding-bottom: 8px;">{escape(r)}</td>
                      </tr>
                """
                for r in shortlist_reasons[:5]
            )
            shortlist_reasons_section = f"""
              <!-- Section 3: Why You Were Shortlisted -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #1E3A8A; margin-bottom: 12px;">
                      Why You Were Shortlisted
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                      {reasons_rows}
                    </table>
                  </td>
                </tr>
              </table>
            """
        else:
            shortlist_reasons_section = ""

        # Section 4: Interview Focus Topics
        interview_topics = context.interview_topics or []
        if interview_topics:
            topics_rows = "".join(
                f"""
                      <tr>
                        <td valign="top" width="24" style="color: #2563EB; font-size: 14px; padding-bottom: 8px;">🎯</td>
                        <td style="font-size: 14px; color: #334155; line-height: 20px; padding-bottom: 8px; font-weight: 500;">{escape(t)}</td>
                      </tr>
                """
                for t in interview_topics[:3]
            )
            focus_topics_section = f"""
              <!-- Section 4: Interview Focus Topics -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #1E3A8A; margin-bottom: 12px;">
                      Interview Focus Topics
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                      {topics_rows}
                    </table>
                  </td>
                </tr>
              </table>
            """
        else:
            focus_topics_section = ""

        # Section 5: Interview Instructions
        instructions = context.interview_instructions or EmailTemplateBuilder.DEFAULT_INSTRUCTIONS
        grid_rows = ""
        for i in range(0, len(instructions), 2):
            left = instructions[i]
            right = instructions[i+1] if i+1 < len(instructions) else None
            
            def get_emoji(text: str, idx: int) -> str:
                t = text.lower()
                if "internet" in t or "stable" in t or "connection" in t:
                    return "📶"
                if "laptop" in t or "desktop" in t or "computer" in t:
                    return "💻"
                if "sitting" in t or "uninterrupted" in t or "session" in t or "sitting" in t or "one sitting" in t:
                    return "⏱️"
                if "microphone" in t or "mic" in t or "audio" in t:
                    return "🎙️"
                if "quiet" in t or "environment" in t or "noise" in t:
                    return "🤫"
                if "resume" in t or "notes" in t or "document" in t:
                    return "📄"
                fallbacks = ["📶", "💻", "⏱️", "🎙️", "🤫", "📄"]
                return fallbacks[idx % len(fallbacks)]
            
            emoji_left = get_emoji(left, i)
            emoji_right = get_emoji(right, i+1) if right else ""
            
            left_col = f"""
                  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <tr>
                      <td valign="top" style="color: #2563EB; padding-right: 8px; font-size: 16px;">{emoji_left}</td>
                      <td style="color: #475569; font-size: 14px; line-height: 20px;">{escape(left)}</td>
                    </tr>
                  </table>
            """
            
            if right:
                right_col = f"""
                  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                    <tr>
                      <td valign="top" style="color: #2563EB; padding-right: 8px; font-size: 16px;">{emoji_right}</td>
                      <td style="color: #475569; font-size: 14px; line-height: 20px;">{escape(right)}</td>
                    </tr>
                  </table>
                """
            else:
                right_col = ""
                
            grid_rows += f"""
              <tr>
                <td width="50%" valign="top" style="padding-right: 12px; padding-bottom: 12px;">
                  {left_col}
                </td>
                <td width="50%" valign="top" style="padding-bottom: 12px;">
                  {right_col}
                </td>
              </tr>
            """
            
        instructions_grid = f"""
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 12px; border-collapse: collapse;">
            {grid_rows}
          </table>
        """

        return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Interview Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F8FAFC" style="table-layout: fixed; padding: 32px 16px; border-collapse: collapse;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); overflow: hidden; border-collapse: collapse;">
          
          <!-- Banner Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); padding: 36px 32px; color: #FFFFFF;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 32px; color: #FFFFFF;">
                      Congratulations, {candidate_name}!
                    </h1>
                    <p style="margin: 12px 0 0 0; font-size: 15px; opacity: 0.9; line-height: 22px; color: #FFFFFF;">
                      {header_subtext}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
                Dear {candidate_name},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #334155;">
                We are pleased to invite you to the next stage of our evaluation process. Below are the details of your shortlisted profile and instructions to complete your interview.
              </p>

              <!-- Section 1: Candidate Summary -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border: 1px solid #F1F5F9; border-radius: 8px; background-color: #FAFAFA; border-collapse: separate;">
                <tr>
                  <td style="padding: 20px;">
                    <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #1E3A8A; margin-bottom: 12px;">
                      Candidate Summary
                    </div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                      <!-- Candidate Name Row -->
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #475569;">Candidate Name</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 600; color: #0F172A; text-align: right;">{candidate_name}</td>
                      </tr>
                      {position_row}
                      <!-- Resume Score Row -->
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; color: #475569;">Resume Match Score</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; font-weight: 700; color: #2563EB; text-align: right;">{context.resume_score:.0f}/100</td>
                      </tr>
                      {mode_row}
                      {duration_row}
                    </table>
                  </td>
                </tr>
              </table>
              {skills_section}
              {shortlist_reasons_section}
              {focus_topics_section}

              <!-- Section 5: Interview Instructions -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td>
                    <div style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: #1E3A8A; margin-bottom: 12px;">
                      Interview Instructions
                    </div>
                    {instructions_grid}
                  </td>
                </tr>
              </table>

              <!-- Section 6: Security Notice -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFBEB; border-left: 4px solid #D97706; border-radius: 4px; margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 16px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                      <tr>
                        <td valign="top" style="padding-right: 12px; font-size: 18px;">🔒</td>
                        <td>
                          <div style="font-size: 14px; font-weight: 700; color: #92400E; margin-bottom: 6px;">Security & Expiry Notice</div>
                          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                            <tr>
                              <td valign="top" width="12" style="color: #B45309; font-size: 12px; padding-right: 6px;">•</td>
                              <td style="font-size: 13px; color: #B45309; line-height: 18px; padding-bottom: 4px;">This unique interview link is generated exclusively for you. Do not share it.</td>
                            </tr>
                            <tr>
                              <td valign="top" width="12" style="color: #B45309; font-size: 12px; padding-right: 6px;">•</td>
                              <td style="font-size: 13px; color: #B45309; line-height: 18px; padding-bottom: 4px;">Your link expires at <strong style="color: #78350F;">{link_expiry}</strong>.</td>
                            </tr>
                            <tr>
                              <td valign="top" width="12" style="color: #B45309; font-size: 12px; padding-right: 6px;">•</td>
                              <td style="font-size: 13px; color: #B45309; line-height: 18px;">If the link has expired, please reach out to your recruiter at <a href="mailto:{recruiter_contact}" style="color: #2563EB; text-decoration: underline; font-weight: 500;">{recruiter_contact}</a>.</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Section 7: CTA Button -->
              <table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 32px 0; text-align: center; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <table border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                      <tr>
                        <td align="center" style="border-radius: 6px;" bgcolor="#2563EB">
                          <a href="{interview_url}" target="_blank" style="font-size: 15px; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 6px; padding: 14px 32px; border: 1px solid #2563EB; display: inline-block; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">START INTERVIEW</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Salutation -->
              <p style="margin: 24px 0 0 0; font-size: 15px; line-height: 24px; color: #334155;">
                Best regards,<br />
                <strong>Recruitment Team</strong><br />
                {company_name}
              </p>

            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748B; line-height: 18px;">
              This email was automatically generated by <strong>{company_name}</strong>. If you did not apply or register for this position, please ignore this email.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>""".strip()

    def _render_plain(self, context: EmailTemplateContext) -> str:
        reasons = "\n".join(f"- {item}" for item in context.shortlist_reasons[:5]) if context.shortlist_reasons else ""
        topics = "\n".join(f"- {item}" for item in context.interview_topics[:3]) if context.interview_topics else ""
        instructions = "\n".join(f"- {item}" for item in context.interview_instructions) if context.interview_instructions else ""
        
        reasons_block = f"Shortlist reasons:\n{reasons}\n\n" if reasons else ""
        topics_block = f"Interview topics:\n{topics}\n\n" if topics else ""
        instructions_block = f"Instructions:\n{instructions}\n\n" if instructions else ""
        
        position_part = f" for {context.position_name}" if context.position_name else ""
        company_name = context.company_name or "Intelligent Candidate Discovery"
        
        return (
            f"Hello {context.candidate_name},\n\n"
            f"You have been shortlisted{position_part} at {company_name}.\n"
            f"Resume score: {context.resume_score:.0f}\n\n"
            f"{reasons_block}"
            f"{topics_block}"
            f"Interview link: {context.interview_url}\n"
            f"Link expires at: {context.link_expiry}\n\n"
            f"{instructions_block}"
            f"Contact: {context.recruiter_contact}\n"
        )

