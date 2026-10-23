// DEMO DATA ONLY — replace with API results from src/services/api.js
export const meetings = [
  { id: 'q4-strategy', title: 'Q4 Product Strategy Review', status: 'live', when: 'Started 15 min ago', people: 8, duration: 'Recording' },
  { id: 'eng-sprint', title: 'Engineering Sprint Planning', status: 'done', when: 'Yesterday, 2:30 PM', people: 12, duration: '1h 15min', color: '#16a34a' },
  { id: 'client-acme', title: 'Client Onboarding - Acme Corp', status: 'done', when: 'Yesterday, 10:00 AM', people: 5, duration: '52 min', color: '#6d4fc2' },
  { id: 'weekly-standup', title: 'Weekly Team Standup', status: 'done', when: 'Dec 8, 9:00 AM', people: 15, duration: '28 min', color: '#2563eb' },
]
export const upcoming = [
  { id: 'design-review', time: '11:00', ap: 'AM', title: 'Design Review Session', people: ['SN', 'JC', 'MK', '+2'] },
  { id: 'investor', time: '2:00', ap: 'PM', title: 'Investor Update Call', people: ['AL', 'RP'] },
  { id: 'one-on-one', time: '4:30', ap: 'PM', title: '1:1 with Engineering Lead', people: ['TB'] },
]
export const transcript = [
  { who: 'Sarah Nguyen', text: "Let's focus on the {mobile app launch} timeline for Q1. We need to finalize the feature set by end of this week." },
  { who: 'James Chen', text: 'I agree. The {beta testing} phase should start no later than January 15th to meet our deadline.' },
  { who: 'Maria Kim', text: "I'll prepare the {marketing materials} and coordinate with the design team this week." },
]
export const insights = [
  { title: 'Key Decision Made', body: 'Mobile app launch confirmed for Q1 2025. Beta testing starts Jan 15.' },
  { title: 'Meeting Efficiency', body: 'Your meetings are 23% more productive this week.' },
]
export const participants = [
  { id: 1, name: 'John Bergson', muted: false, cam: true, speaking: false },
  { id: 2, name: 'Sarah Franci', muted: false, cam: true, speaking: true },
  { id: 3, name: 'Lydia Botosh', muted: true, cam: true, speaking: false },
  { id: 4, name: 'You', muted: false, cam: false, speaking: false },
]
export const liveTranscript = [
  { who: 'John Bergson', t: '10:15', text: "Good morning, everyone. It's time for our daily standup. I'll start. Yesterday, I worked on refining the user flows for the new onboarding process, and today, I'll be reviewing the feedback from our last usability testing session.", hl: "Yesterday, I worked on refining the user flows for the new onboarding process, and today, I'll be reviewing the feedback from our last usability testing session.", notes: 1 },
  { who: 'Sarah Franci', t: '10:16', text: "Hi, everyone. I continued working on the wireframes for the mobile app redesign. I've incorporated the feedback from the last design review. Today, I'll be focusing on finalizing the interactive prototypes for user testing." },
  { who: 'Lydia Botosh', t: '10:17', text: "Good morning. I've been collaborating with the development team to implement some of the design changes in the current sprint. Today, I'll be creating a design guideline document." },
]
