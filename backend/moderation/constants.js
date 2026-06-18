// Shared constants for harm categories and their human-readable labels.
// Imported by classifier, policy engine, routes, and seed.

export const HARM_CATEGORIES = [
  'hate_speech',
  'harassment',
  'spam',
  'misinformation',
  'graphic_violence',
  'adult_content',
  'self_harm',
];

export const CATEGORY_LABELS = {
  hate_speech: 'Hate Speech',
  harassment: 'Harassment',
  spam: 'Spam',
  misinformation: 'Misinformation',
  graphic_violence: 'Graphic Violence',
  adult_content: 'Adult Content',
  self_harm: 'Self-Harm',
};
