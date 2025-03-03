import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class CustomMailerService {
  constructor(private readonly mailerService: MailerService) {}

  /**
   * Sends an email using a template
   * @param to Recipient email address
   * @param subject Email subject
   * @param templateName Name of the template file (without extension)
   * @param context Data to be passed to the template
   * @param attachments Optional email attachments
   */
  async sendEmailWithTemplate(
    to: string,
    subject: string,
    templateName: string,
    context: any,
    attachments?: any[],
  ): Promise<void> {
    try {
      // Read the template file
      const templatePath = path.join(
        process.cwd(),
        'templates',
        `${templateName}.hbs`,
      );
      const template = fs.readFileSync(templatePath, 'utf8');

      // Compile the template with Handlebars
      const compiledTemplate = handlebars.compile(template);
      const html = compiledTemplate(context);

      // Send the email
      await this.mailerService.sendMail({
        to,
        subject,
        html,
        attachments,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Sends a team invitation email
   * @param to Recipient email address
   * @param teamName Name of the team
   * @param inviteLink Link to accept the invitation
   * @param expiresAt Expiration date of the invitation
   */
  async sendTeamInvitationEmail(
    to: string,
    teamName: string,
    inviteLink: string,
    expiresAt: Date,
  ): Promise<void> {
    const context = {
      teamName,
      inviteLink,
      expiresAt: expiresAt.toLocaleDateString(),
    };

    await this.sendEmailWithTemplate(
      to,
      `Invitation to join ${teamName}`,
      'team-invitation',
      context,
    );
  }
}
