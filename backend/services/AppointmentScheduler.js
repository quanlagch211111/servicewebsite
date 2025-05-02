const Appointment = require('../models/Appointment');
const EmailService = require('./EmailService');

/**
 * Send reminders for upcoming appointments
 * This function should be scheduled to run periodically (e.g., every hour)
 */
const sendAppointmentReminders = async () => {
  try {
    const now = new Date();
    
    // Find all unsent reminders that are due
    const appointmentsToRemind = await Appointment.find({
      status: { $in: ['SCHEDULED', 'RESCHEDULED'] },
      'reminders.time': { $lte: now },
      'reminders.sent': false
    }).populate('client').populate('staff');

    console.log(`Found ${appointmentsToRemind.length} appointments needing reminders`);

    // Send reminders
    for (const appointment of appointmentsToRemind) {
      // Find unsent reminders
      const unsentReminders = appointment.reminders.filter(
        reminder => !reminder.sent && reminder.time <= now
      );

      for (const reminder of unsentReminders) {
        // Calculate time until appointment
        const timeUntilAppointment = appointment.startTime - reminder.time;
        let timeframeText = 'soon'; // Default
        
        if (timeUntilAppointment >= 24 * 60 * 60 * 1000) {
          timeframeText = '1 day';
        } else if (timeUntilAppointment >= 60 * 60 * 1000) {
          timeframeText = '1 hour';
        }

        try {
          // Send reminder email
          await EmailService.sendAppointmentReminder(
            appointment,
            appointment.client,
            timeframeText
          );
          
          // Update reminder as sent
          const reminderIndex = appointment.reminders.findIndex(
            r => r._id.toString() === reminder._id.toString()
          );
          
          if (reminderIndex !== -1) {
            appointment.reminders[reminderIndex].sent = true;
          }
          
          await appointment.save();
          
          console.log(`Sent reminder for appointment ${appointment._id} (${timeframeText} before)`);
        } catch (error) {
          console.error(`Error sending reminder for appointment ${appointment._id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error processing appointment reminders:', error);
  }
};

module.exports = {
  sendAppointmentReminders
};