require('dotenv').config();
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const User = require('../models/User');

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD ,
    }
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email content (HTML)
 * @param {string} textContent - Email content (plain text fallback)
 * @returns {Promise<Object>} - Email sending result
 */
const sendEmail = async (to, subject, htmlContent, textContent) => {
    try {
        // Define email options
        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html: htmlContent,
            text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Notify admin about new user registration
 * @param {Object} user - Newly registered user
 * @returns {Promise<Object>} - Email sending result
 */
const sendUserRegistrationNotification = async (user) => {
    // Find admin emails
    const admins = await User.find({ role: 'ADMIN' }).select('email');
    const adminEmails = admins.map(admin => admin.email);

    if (adminEmails.length === 0) {
        console.log('No admin emails found to notify about user registration');
        return { success: false, error: 'No admin recipients found' };
    }

    const subject = 'New User Registration';
    const htmlContent = `
        <h1>New User Registration</h1>
        <p>A new user has registered on the platform:</p>
        <ul>
            <li><strong>Username:</strong> ${user.username}</li>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Registered on:</strong> ${new Date(user.created_at).toLocaleString()}</li>
        </ul>
        <p>Please review the user account if necessary.</p>
    `;

    return await sendEmail(adminEmails.join(','), subject, htmlContent);
};

/**
 * Send welcome email to newly registered user
 * @param {Object} user - Newly registered user
 * @returns {Promise<Object>} - Email sending result
 */
const sendWelcomeEmail = async (user) => {
    const subject = 'Welcome to Our Service Platform!';
    const htmlContent = `
        <h1>Welcome to Our Service Platform!</h1>
        <p>Hello ${user.username},</p>
        <p>Thank you for registering with our service platform. We're excited to have you on board!</p>
        <h2>What you can do now:</h2>
        <ul>
            <li>Explore our real estate offerings</li>
            <li>Apply for visa services</li>
            <li>Check insurance policies</li>
            <li>Get tax consultation</li>
            <li>Create support tickets for any assistance</li>
        </ul>
        <p>If you have any questions, please don't hesitate to contact our support team by creating a ticket on the platform.</p>
        <p>Best regards,<br>The Service Platform Team</p>
    `;

    return await sendEmail(user.email, subject, htmlContent);
};

/**
 * Send password reset email
 * @param {Object} user - User requesting password reset
 * @param {string} resetToken - Password reset token
 * @returns {Promise<Object>} - Email sending result
 */
const sendPasswordResetEmail = async (user, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const htmlContent = `
        <h1>Password Reset Request</h1>
        <p>Hello ${user.username},</p>
        <p>You requested a password reset. Please click the button below to reset your password:</p>
        <p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Reset Password
            </a>
        </p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>The link will expire in 1 hour for security reasons.</p>
        <p>Best regards,<br>The Service Platform Team</p>
    `;

    return await sendEmail(user.email, subject, htmlContent);
};

// ----------------------- TICKET NOTIFICATIONS -----------------------

/**
 * Notify admins and support staff about new ticket
 * @param {Object} ticket - Newly created ticket
 * @param {Object} user - User who created the ticket
 * @returns {Promise<Object>} - Email sending result
 */
const notifyNewTicket = async (ticket, user) => {
    // Find admin and support emails
    const staff = await User.find({ 
        role: { $in: ['ADMIN', 'SUPPORT'] } 
    }).select('email');
    
    const staffEmails = staff.map(s => s.email);

    if (staffEmails.length === 0) {
        console.log('No staff emails found to notify about new ticket');
        return { success: false, error: 'No staff recipients found' };
    }

    const subject = `New Support Ticket: ${ticket.title}`;
    const htmlContent = `
        <h1>New Support Ticket</h1>
        <p>A new support ticket has been created:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>Category:</strong> ${ticket.category}</li>
            <li><strong>Priority:</strong> ${ticket.priority}</li>
            <li><strong>Created by:</strong> ${user.username} (${user.email})</li>
            <li><strong>Created on:</strong> ${new Date(ticket.created_at).toLocaleString()}</li>
        </ul>
        <h3>Description:</h3>
        <p>${ticket.description}</p>
        <p>Please check the ticket and assign it to the appropriate staff member.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
    `;

    return await sendEmail(staffEmails.join(','), subject, htmlContent);
};

/**
 * Send ticket confirmation to user
 * @param {Object} ticket - Newly created ticket
 * @param {Object} user - User who created the ticket
 * @returns {Promise<Object>} - Email sending result
 */
const sendTicketConfirmation = async (ticket, user) => {
    const subject = `Ticket Created: ${ticket.title}`;
    const htmlContent = `
        <h1>Your Support Ticket Has Been Created</h1>
        <p>Hello ${user.username},</p>
        <p>Thank you for contacting us. Your support ticket has been created successfully:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>Category:</strong> ${ticket.category}</li>
            <li><strong>Priority:</strong> ${ticket.priority}</li>
            <li><strong>Status:</strong> ${ticket.status}</li>
        </ul>
        <p>Our support team has been notified and will review your ticket as soon as possible.</p>
        <p>You can view and track the status of your ticket by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
        <p>Best regards,<br>The Support Team</p>
    `;

    return await sendEmail(user.email, subject, htmlContent);
};

/**
 * Notify user about ticket status change
 * @param {Object} ticket - Updated ticket
 * @param {Object} user - Ticket owner
 * @param {string} previousStatus - Previous ticket status
 * @returns {Promise<Object>} - Email sending result
 */
const notifyTicketStatusChange = async (ticket, user, previousStatus) => {
    const subject = `Ticket Status Update: ${ticket.title}`;
    const htmlContent = `
        <h1>Your Ticket Status Has Changed</h1>
        <p>Hello ${user.username},</p>
        <p>The status of your support ticket has been updated:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>Previous Status:</strong> ${previousStatus}</li>
            <li><strong>New Status:</strong> ${ticket.status}</li>
        </ul>
        <p>You can view the latest updates on your ticket by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
        <p>Best regards,<br>The Support Team</p>
    `;

    return await sendEmail(user.email, subject, htmlContent);
};

/**
 * Notify user about new message on their ticket
 * @param {Object} ticket - Ticket with new message
 * @param {Object} user - Ticket owner
 * @param {Object} message - New message
 * @param {Object} sender - Message sender
 * @returns {Promise<Object>} - Email sending result
 */
const notifyNewTicketMessage = async (ticket, user, message, sender) => {
    // Don't send notification if the user is the message sender
    if (user._id.toString() === sender._id.toString()) {
        return { success: true, skipped: true };
    }

    const subject = `New Message on Your Ticket: ${ticket.title}`;
    const htmlContent = `
        <h1>New Message on Your Support Ticket</h1>
        <p>Hello ${user.username},</p>
        <p>A new message has been added to your ticket:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>From:</strong> ${sender.username}</li>
        </ul>
        <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #1976d2; border-radius: 4px;">
            <p><strong>Message:</strong></p>
            <p>${message.content}</p>
        </div>
        <p>Please click the button below to view and respond to this message:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
        <p>Best regards,<br>The Support Team</p>
    `;

    return await sendEmail(user.email, subject, htmlContent);
};

/**
 * Notify staff about new message on assigned ticket
 * @param {Object} ticket - Ticket with new message
 * @param {Object} assignedUser - User assigned to the ticket
 * @param {Object} message - New message
 * @param {Object} sender - Message sender
 * @returns {Promise<Object>} - Email sending result
 */
const notifyStaffNewTicketMessage = async (ticket, assignedUser, message, sender) => {
    // Don't send notification if the assigned user is the message sender
    if (assignedUser._id.toString() === sender._id.toString()) {
        return { success: true, skipped: true };
    }

    const subject = `New Message on Assigned Ticket: ${ticket.title}`;
    const htmlContent = `
        <h1>New Message on Assigned Ticket</h1>
        <p>Hello ${assignedUser.username},</p>
        <p>A new message has been added to a ticket assigned to you:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>From:</strong> ${sender.username}</li>
        </ul>
        <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #1976d2; border-radius: 4px;">
            <p><strong>Message:</strong></p>
            <p>${message.content}</p>
        </div>
        <p>Please click the button below to view and respond to this message:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
        <p>Best regards,<br>The Support Team</p>
    `;

    return await sendEmail(assignedUser.email, subject, htmlContent);
};

/**
 * Notify user about ticket assignment
 * @param {Object} ticket - Assigned ticket
 * @param {Object} user - Ticket owner
 * @param {Object} assignedTo - User assigned to the ticket
 * @returns {Promise<Object>} - Email sending result
 */
const notifyTicketAssignment = async (ticket, user, assignedTo) => {
    const subject = `Ticket Update: ${ticket.title}`;
    const htmlContent = `
        <h1>Your Ticket Has Been Assigned</h1>
        <p>Hello ${user.username},</p>
        <p>Your support ticket has been assigned to ${assignedTo.username}:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>Status:</strong> ${ticket.status}</li>
            <li><strong>Assigned To:</strong> ${assignedTo.username}</li>
        </ul>
        <p>Rest assured that your ticket is now being handled by our support team.</p>
        <p>You can view the latest updates on your ticket by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
        <p>Best regards,<br>The Support Team</p>
    `;

    return await sendEmail(user.email, subject, htmlContent);
};

/**
 * Notify staff member about ticket assignment
 * @param {Object} ticket - Assigned ticket
 * @param {Object} assignedTo - User assigned to the ticket
 * @returns {Promise<Object>} - Email sending result
 */
const notifyStaffTicketAssignment = async (ticket, assignedTo) => {
    const subject = `New Ticket Assignment: ${ticket.title}`;
    const htmlContent = `
        <h1>New Ticket Assigned to You</h1>
        <p>Hello ${assignedTo.username},</p>
        <p>A support ticket has been assigned to you:</p>
        <ul>
            <li><strong>Ticket ID:</strong> ${ticket._id}</li>
            <li><strong>Title:</strong> ${ticket.title}</li>
            <li><strong>Category:</strong> ${ticket.category}</li>
            <li><strong>Priority:</strong> ${ticket.priority}</li>
            <li><strong>Status:</strong> ${ticket.status}</li>
            <li><strong>Created by:</strong> ${ticket.user.username}</li>
        </ul>
        <p>Please review this ticket as soon as possible.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tickets/${ticket._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Ticket
            </a>
        </p>
        <p>Best regards,<br>The Support Team</p>
    `;

    return await sendEmail(assignedTo.email, subject, htmlContent);
};

// ----------------------- REAL ESTATE NOTIFICATIONS -----------------------

/**
 * Notify about new property listing
 * @param {Object} property - New property
 * @param {Object} owner - Property owner
 * @returns {Promise<Object>} - Email sending result
 */
const notifyNewProperty = async (property, owner) => {
    // Find agent emails if property has an agent
    let agentEmails = [];
    if (property.agent) {
        const agent = await User.findById(property.agent).select('email');
        if (agent) {
            agentEmails.push(agent.email);
        }
    }

    // Find admin emails
    const admins = await User.find({ role: 'ADMIN' }).select('email');
    const adminEmails = admins.map(admin => admin.email);

    const recipients = [...new Set([...agentEmails, ...adminEmails])];

    if (recipients.length === 0) {
        return { success: false, error: 'No recipients found' };
    }

    const subject = `New Property Listing: ${property.title}`;
    const htmlContent = `
        <h1>New Property Listing</h1>
        <p>A new property has been listed on the platform:</p>
        <ul>
            <li><strong>Title:</strong> ${property.title}</li>
            <li><strong>Type:</strong> ${property.type}</li>
            <li><strong>Price:</strong> $${property.price.toLocaleString()}</li>
            <li><strong>Location:</strong> ${property.location.address}, ${property.location.city}</li>
            <li><strong>Status:</strong> ${property.status}</li>
            <li><strong>Owner:</strong> ${owner.username}</li>
        </ul>
        <p>Please review this property listing.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/real-estate/${property._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Property
            </a>
        </p>
    `;

    return await sendEmail(recipients.join(','), subject, htmlContent);
};

/**
 * Notify owner about property status change
 * @param {Object} property - Updated property
 * @param {Object} owner - Property owner
 * @param {string} previousStatus - Previous property status
 * @returns {Promise<Object>} - Email sending result
 */
const notifyPropertyStatusChange = async (property, owner, previousStatus) => {
    const subject = `Property Status Update: ${property.title}`;
    const htmlContent = `
        <h1>Property Status Update</h1>
        <p>Hello ${owner.username},</p>
        <p>The status of your property listing has been updated:</p>
        <ul>
            <li><strong>Property:</strong> ${property.title}</li>
            <li><strong>Previous Status:</strong> ${previousStatus}</li>
            <li><strong>New Status:</strong> ${property.status}</li>
        </ul>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/real-estate/${property._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Property
            </a>
        </p>
        <p>Best regards,<br>The Real Estate Team</p>
    `;

    return await sendEmail(owner.email, subject, htmlContent);
};

/**
 * Notify agent about property assignment
 * @param {Object} property - Assigned property
 * @param {Object} agent - Agent assigned to the property
 * @returns {Promise<Object>} - Email sending result
 */
const notifyAgentPropertyAssignment = async (property, agent) => {
    const subject = `New Property Assignment: ${property.title}`;
    const htmlContent = `
        <h1>New Property Assignment</h1>
        <p>Hello ${agent.username},</p>
        <p>You have been assigned to a property:</p>
        <ul>
            <li><strong>Property:</strong> ${property.title}</li>
            <li><strong>Type:</strong> ${property.type}</li>
            <li><strong>Price:</strong> $${property.price.toLocaleString()}</li>
            <li><strong>Location:</strong> ${property.location.address}, ${property.location.city}</li>
            <li><strong>Status:</strong> ${property.status}</li>
        </ul>
        <p>Please review this property as soon as possible.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/real-estate/${property._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Property
            </a>
        </p>
        <p>Best regards,<br>The Real Estate Team</p>
    `;

    return await sendEmail(agent.email, subject, htmlContent);
};

// ----------------------- VISA APPLICATION NOTIFICATIONS -----------------------

/**
 * Notify about new visa application
 * @param {Object} visaApplication - New visa application
 * @param {Object} applicant - Visa applicant
 * @returns {Promise<Object>} - Email sending result
 */
const notifyNewVisaApplication = async (visaApplication, applicant) => {
    // Find admin and agent emails
    const staff = await User.find({ 
        role: { $in: ['ADMIN', 'AGENT'] } 
    }).select('email');
    
    const staffEmails = staff.map(s => s.email);

    if (staffEmails.length === 0) {
        return { success: false, error: 'No staff recipients found' };
    }

    const subject = `New Visa Application: ${applicant.username}`;
    const htmlContent = `
        <h1>New Visa Application</h1>
        <p>A new visa application has been submitted:</p>
        <ul>
            <li><strong>Application ID:</strong> ${visaApplication._id}</li>
            <li><strong>Type:</strong> ${visaApplication.type}</li>
            <li><strong>Destination:</strong> ${visaApplication.destination}</li>
            <li><strong>Applicant:</strong> ${applicant.username} (${applicant.email})</li>
            <li><strong>Status:</strong> ${visaApplication.status}</li>
            <li><strong>Submission Date:</strong> ${new Date(visaApplication.created_at).toLocaleString()}</li>
        </ul>
        <p>Please review this visa application.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/visa/${visaApplication._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Application
            </a>
        </p>
    `;

    return await sendEmail(staffEmails.join(','), subject, htmlContent);
};

/**
 * Send visa application confirmation to applicant
 * @param {Object} visaApplication - New visa application
 * @param {Object} applicant - Visa applicant
 * @returns {Promise<Object>} - Email sending result
 */
const sendVisaApplicationConfirmation = async (visaApplication, applicant) => {
    const subject = `Visa Application Received: ${visaApplication.destination}`;
    const htmlContent = `
        <h1>Your Visa Application Has Been Received</h1>
        <p>Hello ${applicant.username},</p>
        <p>Thank you for submitting your visa application. Here are the details of your application:</p>
        <ul>
            <li><strong>Application ID:</strong> ${visaApplication._id}</li>
            <li><strong>Type:</strong> ${visaApplication.type}</li>
            <li><strong>Destination:</strong> ${visaApplication.destination}</li>
            <li><strong>Status:</strong> ${visaApplication.status}</li>
            <li><strong>Submission Date:</strong> ${new Date(visaApplication.created_at).toLocaleString()}</li>
        </ul>
        <p>Our team will review your application and update you on the progress.</p>
        <p>You can track the status of your application by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/visa/${visaApplication._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Application
            </a>
        </p>
        <p>Best regards,<br>The Visa Services Team</p>
    `;

    return await sendEmail(applicant.email, subject, htmlContent);
};

/**
 * Notify applicant about visa status change
 * @param {Object} visaApplication - Updated visa application
 * @param {Object} applicant - Visa applicant
 * @param {string} previousStatus - Previous application status
 * @param {string} notes - Additional notes for status change
 * @returns {Promise<Object>} - Email sending result
 */
const notifyVisaStatusChange = async (visaApplication, applicant, previousStatus, notes) => {
    const subject = `Visa Application Status Update: ${visaApplication.destination}`;
    
    let statusMessage = '';
    if (visaApplication.status === 'APPROVED') {
        statusMessage = '<p style="color: green; font-weight: bold;">Congratulations! Your visa application has been approved.</p>';
    } else if (visaApplication.status === 'REJECTED') {
        statusMessage = '<p style="color: red; font-weight: bold;">We regret to inform you that your visa application has been rejected.</p>';
    } else if (visaApplication.status === 'ADDITIONAL_INFO_REQUIRED') {
        statusMessage = '<p style="color: orange; font-weight: bold;">Your application requires additional information. Please see the notes below and update your application accordingly.</p>';
    } else if (visaApplication.status === 'PROCESSING') {
        statusMessage = '<p style="color: blue; font-weight: bold;">Your application is now being processed by our team.</p>';
    }

    const htmlContent = `
        <h1>Visa Application Status Update</h1>
        <p>Hello ${applicant.username},</p>
        ${statusMessage}
        <ul>
            <li><strong>Application ID:</strong> ${visaApplication._id}</li>
            <li><strong>Destination:</strong> ${visaApplication.destination}</li>
            <li><strong>Previous Status:</strong> ${previousStatus}</li>
            <li><strong>New Status:</strong> ${visaApplication.status}</li>
        </ul>
        ${notes ? `<h3>Additional Notes:</h3><p>${notes}</p>` : ''}
        <p>You can check the latest updates on your application by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/visa/${visaApplication._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Application
            </a>
        </p>
        <p>Best regards,<br>The Visa Services Team</p>
    `;

    return await sendEmail(applicant.email, subject, htmlContent);
};

/**
 * Notify agent about visa assignment
 * @param {Object} visaApplication - Assigned visa application
 * @param {Object} agent - Agent assigned to the application
 * @returns {Promise<Object>} - Email sending result
 */
const notifyAgentVisaAssignment = async (visaApplication, agent) => {
    const subject = `New Visa Application Assignment`;
    const htmlContent = `
        <h1>New Visa Application Assignment</h1>
        <p>Hello ${agent.username},</p>
        <p>You have been assigned to a visa application:</p>
        <ul>
            <li><strong>Application ID:</strong> ${visaApplication._id}</li>
            <li><strong>Type:</strong> ${visaApplication.type}</li>
            <li><strong>Destination:</strong> ${visaApplication.destination}</li>
            <li><strong>Applicant:</strong> ${visaApplication.applicant.username}</li>
            <li><strong>Status:</strong> ${visaApplication.status}</li>
        </ul>
        <p>Please review this application as soon as possible.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/visa/${visaApplication._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Application
            </a>
        </p>
        <p>Best regards,<br>The Visa Services Team</p>
    `;

    return await sendEmail(agent.email, subject, htmlContent);
};

// ----------------------- TAX CASE NOTIFICATIONS -----------------------

/**
 * Notify about new tax case
 * @param {Object} taxCase - New tax case
 * @param {Object} client - Tax case client
 * @returns {Promise<Object>} - Email sending result
 */
const notifyNewTaxCase = async (taxCase, client) => {
    // Find admin and support emails
    const staff = await User.find({ 
        role: { $in: ['ADMIN', 'SUPPORT'] } 
    }).select('email');
    
    const staffEmails = staff.map(s => s.email);

    if (staffEmails.length === 0) {
        return { success: false, error: 'No staff recipients found' };
    }

    const subject = `New Tax Case: ${taxCase.type} - ${taxCase.fiscalYear}`;
    const htmlContent = `
        <h1>New Tax Case</h1>
        <p>A new tax case has been submitted:</p>
        <ul>
            <li><strong>Case ID:</strong> ${taxCase._id}</li>
            <li><strong>Type:</strong> ${taxCase.type}</li>
            <li><strong>Fiscal Year:</strong> ${taxCase.fiscalYear}</li>
            <li><strong>Client:</strong> ${client.username} (${client.email})</li>
            <li><strong>Status:</strong> ${taxCase.status}</li>
            <li><strong>Submission Date:</strong> ${new Date(taxCase.created_at).toLocaleString()}</li>
        </ul>
        <p>Please review this tax case.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tax/${taxCase._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Tax Case
            </a>
        </p>
    `;

    return await sendEmail(staffEmails.join(','), subject, htmlContent);
};

/**
 * Send tax case confirmation to client
 * @param {Object} taxCase - New tax case
 * @param {Object} client - Tax case client
 * @returns {Promise<Object>} - Email sending result
 */
const sendTaxCaseConfirmation = async (taxCase, client) => {
    const subject = `Tax Case Received: ${taxCase.type} - ${taxCase.fiscalYear}`;
    const htmlContent = `
        <h1>Your Tax Case Has Been Received</h1>
        <p>Hello ${client.username},</p>
        <p>Thank you for submitting your tax case. Here are the details of your case:</p>
        <ul>
            <li><strong>Case ID:</strong> ${taxCase._id}</li>
            <li><strong>Type:</strong> ${taxCase.type}</li>
            <li><strong>Fiscal Year:</strong> ${taxCase.fiscalYear}</li>
            <li><strong>Status:</strong> ${taxCase.status}</li>
            <li><strong>Submission Date:</strong> ${new Date(taxCase.created_at).toLocaleString()}</li>
        </ul>
        <p>Our tax professionals will review your case and update you on the progress.</p>
        <p>You can track the status of your case by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tax/${taxCase._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Tax Case
            </a>
        </p>
        <p>Best regards,<br>The Tax Services Team</p>
    `;

    return await sendEmail(client.email, subject, htmlContent);
};

/**
 * Notify client about tax case status change
 * @param {Object} taxCase - Updated tax case
 * @param {Object} client - Tax case client
 * @param {string} previousStatus - Previous case status
 * @param {string} notes - Additional notes for status change
 * @returns {Promise<Object>} - Email sending result
 */
const notifyTaxStatusChange = async (taxCase, client, previousStatus, notes) => {
    const subject = `Tax Case Status Update: ${taxCase.type} - ${taxCase.fiscalYear}`;
    
    let statusMessage = '';
    if (taxCase.status === 'COMPLETED') {
        statusMessage = '<p style="color: green; font-weight: bold;">Good news! Your tax case has been completed.</p>';
    } else if (taxCase.status === 'REVISION_NEEDED') {
        statusMessage = '<p style="color: orange; font-weight: bold;">Your tax case requires some revisions. Please see the notes below and update your case accordingly.</p>';
    } else if (taxCase.status === 'IN_PROGRESS') {
        statusMessage = '<p style="color: blue; font-weight: bold;">Your tax case is now being processed by our team.</p>';
    }

    const htmlContent = `
        <h1>Tax Case Status Update</h1>
        <p>Hello ${client.username},</p>
        ${statusMessage}
        <ul>
            <li><strong>Case ID:</strong> ${taxCase._id}</li>
            <li><strong>Type:</strong> ${taxCase.type}</li>
            <li><strong>Fiscal Year:</strong> ${taxCase.fiscalYear}</li>
            <li><strong>Previous Status:</strong> ${previousStatus}</li>
            <li><strong>New Status:</strong> ${taxCase.status}</li>
        </ul>
        ${notes ? `<h3>Additional Notes:</h3><p>${notes}</p>` : ''}
        <p>You can check the latest updates on your case by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tax/${taxCase._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Tax Case
            </a>
        </p>
        <p>Best regards,<br>The Tax Services Team</p>
    `;

    return await sendEmail(client.email, subject, htmlContent);
};

/**
 * Notify tax professional about case assignment
 * @param {Object} taxCase - Assigned tax case
 * @param {Object} taxProfessional - Tax professional assigned to the case
 * @returns {Promise<Object>} - Email sending result
 */
const notifyTaxProfessionalAssignment = async (taxCase, taxProfessional) => {
    const subject = `New Tax Case Assignment`;
    const htmlContent = `
        <h1>New Tax Case Assignment</h1>
        <p>Hello ${taxProfessional.username},</p>
        <p>You have been assigned to a tax case:</p>
        <ul>
            <li><strong>Case ID:</strong> ${taxCase._id}</li>
            <li><strong>Type:</strong> ${taxCase.type}</li>
            <li><strong>Fiscal Year:</strong> ${taxCase.fiscalYear}</li>
            <li><strong>Client:</strong> ${taxCase.client.username}</li>
            <li><strong>Status:</strong> ${taxCase.status}</li>
        </ul>
        <p>Please review this case as soon as possible.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/tax/${taxCase._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Tax Case
            </a>
        </p>
        <p>Best regards,<br>The Tax Services Team</p>
    `;

    return await sendEmail(taxProfessional.email, subject, htmlContent);
};

// ----------------------- INSURANCE NOTIFICATIONS -----------------------

/**
 * Notify about new insurance policy
 * @param {Object} policy - New insurance policy
 * @param {Object} policyholder - Policy holder
 * @returns {Promise<Object>} - Email sending result
 */
const notifyNewInsurancePolicy = async (policy, policyholder) => {
    // Find admin and agent emails
    const staff = await User.find({ 
        role: { $in: ['ADMIN', 'AGENT'] } 
    }).select('email');
    
    const staffEmails = staff.map(s => s.email);

    if (staffEmails.length === 0) {
        return { success: false, error: 'No staff recipients found' };
    }

    const subject = `New Insurance Policy: ${policy.type} - ${policy.policyNumber}`;
    const htmlContent = `
        <h1>New Insurance Policy</h1>
        <p>A new insurance policy has been created:</p>
        <ul>
            <li><strong>Policy Number:</strong> ${policy.policyNumber}</li>
            <li><strong>Type:</strong> ${policy.type}</li>
            <li><strong>Provider:</strong> ${policy.provider}</li>
            <li><strong>Policyholder:</strong> ${policyholder.username} (${policyholder.email})</li>
            <li><strong>Status:</strong> ${policy.status}</li>
            <li><strong>Creation Date:</strong> ${new Date(policy.created_at).toLocaleString()}</li>
        </ul>
        <p>Please review this insurance policy.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/insurance/${policy._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Policy
            </a>
        </p>
    `;

    return await sendEmail(staffEmails.join(','), subject, htmlContent);
};

/**
 * Send insurance policy confirmation to policyholder
 * @param {Object} policy - New insurance policy
 * @param {Object} policyholder - Policy holder
 * @returns {Promise<Object>} - Email sending result
 */
const sendInsurancePolicyConfirmation = async (policy, policyholder) => {
    const subject = `Insurance Policy Created: ${policy.type} - ${policy.policyNumber}`;
    const htmlContent = `
        <h1>Your Insurance Policy Has Been Created</h1>
        <p>Hello ${policyholder.username},</p>
        <p>Thank you for choosing our insurance services. Here are the details of your policy:</p>
        <ul>
            <li><strong>Policy Number:</strong> ${policy.policyNumber}</li>
            <li><strong>Type:</strong> ${policy.type}</li>
            <li><strong>Provider:</strong> ${policy.provider}</li>
            <li><strong>Status:</strong> ${policy.status}</li>
            <li><strong>Creation Date:</strong> ${new Date(policy.created_at).toLocaleString()}</li>
            <li><strong>Coverage Start:</strong> ${new Date(policy.coverageDetails.startDate).toLocaleDateString()}</li>
            <li><strong>Coverage End:</strong> ${new Date(policy.coverageDetails.endDate).toLocaleDateString()}</li>
            <li><strong>Coverage Amount:</strong> $${policy.coverageDetails.coverageAmount.toLocaleString()}</li>
            <li><strong>Premium:</strong> $${policy.coverageDetails.premium.toLocaleString()} (${policy.coverageDetails.paymentFrequency})</li>
        </ul>
        <p>Our team will review your policy and update you on any changes in status.</p>
        <p>You can view your policy details by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/insurance/${policy._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Policy
            </a>
        </p>
        <p>Best regards,<br>The Insurance Services Team</p>
    `;

    return await sendEmail(policyholder.email, subject, htmlContent);
};

/**
 * Notify policyholder about insurance policy status change
 * @param {Object} policy - Updated insurance policy
 * @param {Object} policyholder - Policy holder
 * @param {string} previousStatus - Previous policy status
 * @returns {Promise<Object>} - Email sending result
 */
const notifyInsuranceStatusChange = async (policy, policyholder, previousStatus) => {
    const subject = `Insurance Policy Status Update: ${policy.policyNumber}`;
    
    let statusMessage = '';
    if (policy.status === 'ACTIVE') {
        statusMessage = '<p style="color: green; font-weight: bold;">Good news! Your insurance policy is now active.</p>';
    } else if (policy.status === 'EXPIRED') {
        statusMessage = '<p style="color: red; font-weight: bold;">Your insurance policy has expired. Please contact us to renew your coverage.</p>';
    } else if (policy.status === 'CANCELLED') {
        statusMessage = '<p style="color: red; font-weight: bold;">Your insurance policy has been cancelled.</p>';
    }

    const htmlContent = `
        <h1>Insurance Policy Status Update</h1>
        <p>Hello ${policyholder.username},</p>
        ${statusMessage}
        <ul>
            <li><strong>Policy Number:</strong> ${policy.policyNumber}</li>
            <li><strong>Type:</strong> ${policy.type}</li>
            <li><strong>Previous Status:</strong> ${previousStatus}</li>
            <li><strong>New Status:</strong> ${policy.status}</li>
        </ul>
        <p>You can check the latest updates on your policy by clicking the button below:</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/insurance/${policy._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Policy
            </a>
        </p>
        <p>Best regards,<br>The Insurance Services Team</p>
    `;

    return await sendEmail(policyholder.email, subject, htmlContent);
};

/**
 * Notify agent about insurance policy assignment
 * @param {Object} policy - Assigned insurance policy
 * @param {Object} agent - Agent assigned to the policy
 * @returns {Promise<Object>} - Email sending result
 */
const notifyAgentInsuranceAssignment = async (policy, agent) => {
    const subject = `New Insurance Policy Assignment: ${policy.policyNumber}`;
    const htmlContent = `
        <h1>New Insurance Policy Assignment</h1>
        <p>Hello ${agent.username},</p>
        <p>You have been assigned to an insurance policy:</p>
        <ul>
            <li><strong>Policy Number:</strong> ${policy.policyNumber}</li>
            <li><strong>Type:</strong> ${policy.type}</li>
            <li><strong>Provider:</strong> ${policy.provider}</li>
            <li><strong>Policyholder:</strong> ${policy.policyholder.username}</li>
            <li><strong>Status:</strong> ${policy.status}</li>
        </ul>
        <p>Please review this policy as soon as possible.</p>
        <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/insurance/${policy._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                View Policy
            </a>
        </p>
        <p>Best regards,<br>The Insurance Services Team</p>
    `;

    return await sendEmail(agent.email, subject, htmlContent);
};

// ----------------------- APPOINTMENT NOTIFICATIONS -----------------------

/**
 * Send appointment confirmation to client
 * @param {Object} appointment - New appointment
 * @param {Object} client - Client who created the appointment
 * @returns {Promise<Object>} - Email sending result
 */
const sendAppointmentConfirmation = async (appointment, client) => {
    const subject = `Appointment Confirmation: ${appointment.title}`;
    
    let serviceTypeFormatted = '';
    switch (appointment.serviceType) {
      case 'REAL_ESTATE': serviceTypeFormatted = 'Real Estate'; break;
      case 'INSURANCE': serviceTypeFormatted = 'Insurance'; break;
      case 'VISA': serviceTypeFormatted = 'Visa Service'; break;
      case 'TAX': serviceTypeFormatted = 'Tax Service'; break;
      case 'OTHER': serviceTypeFormatted = 'Other Service'; break;
    }
  
    const htmlContent = `
      <h1>Your Appointment Has Been Scheduled</h1>
      <p>Hello ${client.username},</p>
      <p>Thank you for scheduling an appointment with us. Your appointment details are:</p>
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Service:</strong> ${serviceTypeFormatted}</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
        <li><strong>Location:</strong> ${appointment.location || 'To be confirmed'}</li>
        <li><strong>Staff Member:</strong> ${appointment.staff.username}</li>
      </ul>
      ${appointment.description ? `<p><strong>Additional Information:</strong> ${appointment.description}</p>` : ''}
      <p>You will receive a reminder before your appointment. If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
      <p>You can view your appointment details by clicking the button below:</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments/${appointment._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointment
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(client.email, subject, htmlContent);
  };
  
  /**
   * Notify staff about new appointment
   * @param {Object} appointment - New appointment
   * @param {Object} staff - Staff assigned to the appointment
   * @returns {Promise<Object>} - Email sending result
   */
  const notifyStaffNewAppointment = async (appointment, staff) => {
    const subject = `New Appointment: ${appointment.title}`;
    
    let serviceTypeFormatted = '';
    switch (appointment.serviceType) {
      case 'REAL_ESTATE': serviceTypeFormatted = 'Real Estate'; break;
      case 'INSURANCE': serviceTypeFormatted = 'Insurance'; break;
      case 'VISA': serviceTypeFormatted = 'Visa Service'; break;
      case 'TAX': serviceTypeFormatted = 'Tax Service'; break;
      case 'OTHER': serviceTypeFormatted = 'Other Service'; break;
    }
  
    const htmlContent = `
      <h1>New Appointment Assigned to You</h1>
      <p>Hello ${staff.username},</p>
      <p>A new appointment has been scheduled and assigned to you:</p>
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Service:</strong> ${serviceTypeFormatted}</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
        <li><strong>Location:</strong> ${appointment.location || 'To be confirmed'}</li>
        <li><strong>Client:</strong> ${appointment.client.username} (${appointment.client.email})</li>
      </ul>
      ${appointment.description ? `<p><strong>Additional Information:</strong> ${appointment.description}</p>` : ''}
      <p>Please review and confirm this appointment. You can view the appointment details by clicking the button below:</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments/${appointment._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointment
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(staff.email, subject, htmlContent);
  };
  
  /**
   * Notify client about appointment status change
   * @param {Object} appointment - Updated appointment
   * @param {Object} client - Client
   * @param {string} previousStatus - Previous appointment status
   * @param {string} notes - Optional notes about the status change
   * @returns {Promise<Object>} - Email sending result
   */
  const notifyAppointmentStatusChange = async (appointment, client, previousStatus, notes) => {
    const subject = `Appointment Status Update: ${appointment.title}`;
    
    let statusMessage = '';
    switch (appointment.status) {
      case 'COMPLETED':
        statusMessage = '<p style="color: green; font-weight: bold;">Your appointment has been marked as completed.</p>';
        break;
      case 'CANCELLED':
        statusMessage = '<p style="color: red; font-weight: bold;">Your appointment has been cancelled.</p>';
        break;
      case 'RESCHEDULED':
        statusMessage = '<p style="color: orange; font-weight: bold;">Your appointment has been rescheduled. Please see the updated details below.</p>';
        break;
      default:
        statusMessage = `<p>The status of your appointment has been updated from ${previousStatus} to ${appointment.status}.</p>`;
    }
  
    const htmlContent = `
      <h1>Appointment Status Update</h1>
      <p>Hello ${client.username},</p>
      ${statusMessage}
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
        <li><strong>Location:</strong> ${appointment.location || 'To be confirmed'}</li>
        <li><strong>Previous Status:</strong> ${previousStatus}</li>
        <li><strong>New Status:</strong> ${appointment.status}</li>
      </ul>
      ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
      <p>You can view the latest details of your appointment by clicking the button below:</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments/${appointment._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointment
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(client.email, subject, htmlContent);
  };
  
  /**
   * Notify staff that an appointment was cancelled
   * @param {Object} appointment - Cancelled appointment
   * @param {Object} staff - Staff assigned to the appointment
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} - Email sending result
   */
  const notifyStaffAppointmentCancelled = async (appointment, staff, reason) => {
    const subject = `Appointment Cancelled: ${appointment.title}`;
    
    const htmlContent = `
      <h1>Appointment Cancelled</h1>
      <p>Hello ${staff.username},</p>
      <p style="color: red; font-weight: bold;">An appointment assigned to you has been cancelled by the client.</p>
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Client:</strong> ${appointment.client.username} (${appointment.client.email})</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
      </ul>
      ${reason ? `<p><strong>Cancellation Reason:</strong> ${reason}</p>` : ''}
      <p>This time slot is now available for other appointments.</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointments
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(staff.email, subject, htmlContent);
  };
  
  /**
   * Notify staff that appointment was reassigned
   * @param {Object} appointment - Reassigned appointment
   * @param {Object} previousStaff - Previous staff
   * @param {Object} newStaff - New staff
   * @returns {Promise<Object>} - Email sending result
   */
  const notifyStaffAppointmentReassigned = async (appointment, previousStaff, newStaff) => {
    const subject = `Appointment Reassigned: ${appointment.title}`;
    
    const htmlContent = `
      <h1>Appointment Reassigned</h1>
      <p>Hello ${previousStaff.username},</p>
      <p>An appointment previously assigned to you has been reassigned to ${newStaff.username}:</p>
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Client:</strong> ${appointment.client.username}</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
      </ul>
      <p>This time slot is now available for other appointments.</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointments
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(previousStaff.email, subject, htmlContent);
  };
  
  /**
   * Notify client that appointment was reassigned
   * @param {Object} appointment - Reassigned appointment
   * @param {Object} client - Client
   * @param {Object} newStaff - New staff
   * @returns {Promise<Object>} - Email sending result
   */
  const notifyClientAppointmentReassigned = async (appointment, client, newStaff) => {
    const subject = `Appointment Update: ${appointment.title}`;
    
    const htmlContent = `
      <h1>Appointment Staff Update</h1>
      <p>Hello ${client.username},</p>
      <p>Your appointment has been reassigned to a different staff member:</p>
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
        <li><strong>New Staff Member:</strong> ${newStaff.username}</li>
      </ul>
      <p>All other appointment details remain the same. If you have any questions, please contact us.</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments/${appointment._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointment
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(client.email, subject, htmlContent);
  };
  
  /**
   * Send appointment reminder to client
   * @param {Object} appointment - Upcoming appointment
   * @param {Object} client - Client
   * @param {string} timeframe - Time until appointment (e.g., "1 day", "1 hour")
   * @returns {Promise<Object>} - Email sending result
   */
  const sendAppointmentReminder = async (appointment, client, timeframe) => {
    const subject = `Reminder: Upcoming Appointment - ${appointment.title}`;
    
    const htmlContent = `
      <h1>Appointment Reminder</h1>
      <p>Hello ${client.username},</p>
      <p>This is a reminder that you have an appointment in ${timeframe}:</p>
      <ul>
        <li><strong>Title:</strong> ${appointment.title}</li>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()} - ${new Date(appointment.endTime).toLocaleTimeString()}</li>
        <li><strong>Location:</strong> ${appointment.location || 'To be confirmed'}</li>
        <li><strong>Staff Member:</strong> ${appointment.staff.username}</li>
      </ul>
      ${appointment.description ? `<p><strong>Additional Information:</strong> ${appointment.description}</p>` : ''}
      <p>If you need to reschedule or cancel, please do so as soon as possible.</p>
      <p>
        <a href="${process.env.FRONTEND_URL}/dashboard/appointments/${appointment._id}" style="display: inline-block; background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          View Appointment
        </a>
      </p>
      <p>Best regards,<br>The Services Team</p>
    `;
  
    return await sendEmail(client.email, subject, htmlContent);
  };

module.exports = {
    sendEmail,
    sendUserRegistrationNotification,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    
    // Ticket notifications
    notifyNewTicket,
    sendTicketConfirmation,
    notifyTicketStatusChange,
    notifyNewTicketMessage,
    notifyStaffNewTicketMessage,
    notifyTicketAssignment,
    notifyStaffTicketAssignment,
    
    // Real Estate notifications
    notifyNewProperty,
    notifyPropertyStatusChange,
    notifyAgentPropertyAssignment,
    
    // Visa notifications
    notifyNewVisaApplication,
    sendVisaApplicationConfirmation,
    notifyVisaStatusChange,
    notifyAgentVisaAssignment,
    
    // Tax notifications
    notifyNewTaxCase,
    sendTaxCaseConfirmation,
    notifyTaxStatusChange,
    notifyTaxProfessionalAssignment,
    
    // Insurance notifications
    notifyNewInsurancePolicy,
    sendInsurancePolicyConfirmation,
    notifyInsuranceStatusChange,
    notifyAgentInsuranceAssignment,

      // Appointment notifications
  sendAppointmentConfirmation,
  notifyStaffNewAppointment,
  notifyAppointmentStatusChange,
  notifyStaffAppointmentCancelled,
  notifyStaffAppointmentReassigned,
  notifyClientAppointmentReassigned,
  sendAppointmentReminder
};