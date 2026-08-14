# Next Visit

Domain for booking medical appointments in a single clinic. Patients book, cancel, and reschedule appointments with a specific doctor on the web without creating an account; the clinic recognizes them by their DNI.

## Language

**Patient**:
A person who books appointments at the clinic, identified by their DNI. Carries first name, last name, health insurance, phone, and email.
_Avoid_: User, account, client

**DNI**:
The national identity number that identifies a patient. It is the identity anchor for booking, cancellation, rescheduling, and anti-spam.
_Avoid_: ID, document, identifier

**Specialty**:
An area of medical care (e.g., cardiology, dermatology). Doctors belong to a specialty; the patient picks a specialty before picking a doctor.
_Avoid_: Service, department, area

**Doctor**:
A healthcare professional who attends appointments. Belongs to one specialty and offers appointment types; each appointment is with a specific doctor.
_Avoid_: Physician, provider, professional

**Secretary**:
A clinic staff member who books appointments on the patient's behalf (at the front desk or by phone), maintains doctors' availability, and records attendance and copays.
_Avoid_: Admin, receptionist, staff

**Admin**:
The clinic staff member who creates the credentials for secretaries and doctors.
_Avoid_: Manager, root

**Appointment Type**:
The kind of care an appointment provides (e.g., consultation, check-up), chosen by the patient after the specialty. Each type has a fixed duration that determines how long its slot is.
_Avoid_: Service, category

**Availability**:
The recurring weekly working hours of a doctor (e.g., Mondays and Wednesdays 9–13), maintained by the secretary, with occasional exceptions for holidays and absences. Slots are derived from it.
_Avoid_: Schedule, opening hours

**Appointment**:
A confirmed booking of a patient with a specific doctor at a specific date and time. Has a type and a duration, and moves through a lifecycle: scheduled, cancelled, or ended.
_Avoid_: Turno, booking, reservation, cita

**Booking Channel**:
How an appointment is booked: web self-service, at the front desk, or by phone. On the web the patient books with their own email; by front desk or phone the secretary books on the patient's behalf and email is optional — when the patient gives one, the same emails are sent as for web bookings.
_Avoid_: Source, medium, origin

**No-show**:
An ended appointment the patient did not attend without cancelling. Marked automatically when the appointment's time passes, and corrected to attended by the secretary if the patient arrives.
_Avoid_: Missed, absent

**Copay**:
The amount a patient pays to attend an appointment, determined by their health insurance. Recorded by the secretary when the patient arrives.
_Avoid_: Payment, fee, charge

**Slot**:
A concrete bookable date-and-time for a specific doctor, derived from that doctor's availability and long enough for the appointment type.
_Avoid_: Time, opening, availability

**One-time Link**:
A link sent by email with a booking that authorizes cancelling or rescheduling that appointment without logging in. It can be used once, and expires when the appointment passes.
_Avoid_: Token, magic link, auth link

**Cancellation Window**:
The period before an appointment during which the patient can cancel online. After it closes, cancellation requires calling the clinic.
_Avoid_: Cutoff, deadline, policy