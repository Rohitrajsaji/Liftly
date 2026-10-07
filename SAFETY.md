# Liftly — Safety

Liftly is a training tool for healthy beginners. It is not a medical product and does not diagnose, treat, or advise on injury.

## 1. Fitness safety boundaries

- The app follows the frozen Progression Engine v1.0. Weights stay on the gym's real loads.
- Progression is conservative: no increases during pain, and no weight changes during a workout.
- Users can stop any exercise at any time.
- Calibration starts light, and the engine corrects errors within a few sessions.
- Beginners train 3 or 4 days a week, with rest prescribed between sets.

## 2. Pain policy (locked)

1. **Any pain reported during an exercise stops that exercise for the session.** Muscle burn and fatigue are effort, not pain.
2. **Progression freezes** for that exercise. Its weight does not increase while the pain is unresolved.
3. **The next exposure uses the approved swap**, starting with the ramp.
4. **The original exercise returns** only after 2 pain-free sessions on the swap, as a first exposure, at the frozen weight.
5. **Serious-pain conditions** (section 3) show the professional-help screen, and the exercise is no longer prescribed.
6. **A second pain report** on the same exercise within 4 weeks makes the swap permanent.

The pain policy is applied as written. It is not a rehabilitation model, and Liftly does not weigh pain levels to decide whether to keep training.

## 3. When the app stops prescribing an exercise

The exercise is removed from prescriptions, and the professional-help screen is shown, when any of these is reported:

- Pain at rest or at night
- Pain still present more than 24 hours later
- Numbness, tingling, swelling, or a feeling of instability
- Pain rated 4/10 or higher
- A second pain report on the same exercise within 4 weeks

The app then shows the professional-help screen. It doesn't diagnose or suggest causes.

## 4. No medical diagnosis

- Liftly never names an injury, condition, or cause.
- Liftly never says that exercising through pain is safe or normal.
- Liftly never recommends treatment, medication, supplements, or rehabilitation exercises.
- Liftly never tells the user to ignore a symptom.

## 5. Fixed messaging vs. Claude messaging

| Situation | Who writes the message | Notes |
|---|---|---|
| Pain reported (stop and swap) | Fixed text | Template, shown exactly as approved |
| Serious-pain screen | Fixed text | Recommends a qualified professional |
| Swap explanation | Fixed text | Neutral description |
| Stall, gap, progression explanation | Claude, then validated | Must use only engine numbers and reason codes |
| Debrief fallback | Fixed text | Used when Claude output fails validation |

### Fixed text (drafts; final wording to be approved before build)

- **Pain stop:** "We've paused this exercise for today. Your next session will use an alternative. Your weight won't go up for this exercise until the pain has settled."
- **Serious-pain screen:** "Some of what you've reported is worth having checked by a qualified professional. Liftly can't tell what's causing it, so we've stopped suggesting this exercise. Your other exercises are unchanged."

[ASSUMPTION] These are drafts. Final wording is reviewed by a qualified professional before testers use it.

## 6. Data and privacy for sensitive fitness information

Training logs, injury notes, and pain reports are sensitive health-related information.

- **Collect the minimum.** Store only the fields in DATA_MODEL.md.
- **Injury notes are optional** and kept out of AI input unless the user chooses to share them. [ASSUMPTION]
- **Use pseudonymous IDs** for analytics and for Claude input. Names, emails, and phone numbers never go to Claude.
- **Consent:** record the user's consent with date. [OPEN: consent text]
- **Retention and deletion:** users can delete their account and data. [OPEN: retention period and deletion scope]
- **Third parties:** list every service that receives user data (including the AI provider) and what it receives. [OPEN]
- **Legal check:** data handling must be checked against Indian data protection law (the Digital Personal Data Protection Act, 2023) before launch. This is a check, not legal advice.
- **Phase 0 data:** testers' data is kept under pseudonymous IDs, with consent. Logs are deleted at the end of the test unless the tester agrees to keep them. [ASSUMPTION]

## 7. Safety review before testers

- Testers are told the experiment is about training logic, not medical care.
- Testers are told to stop any exercise that hurts and to report it.
- [ASSUMPTION] Testers with a known injury are asked to talk to a professional before joining.
