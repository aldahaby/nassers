/**
 * Synthetic, realistic course outlines for Syllabus Intelligence tests and the
 * dev lab. Fictional institutions and people; example.edu addresses only.
 */
const AUG_2026 = Date.UTC(2026, 7, 20, 16, 0);

export interface OutlineFixture {
  id: string;
  label: string;
  timezone: string;
  referenceAt: number;
  /** Pages separated by form feeds. */
  text: string;
}

/** An American multi-page syllabus with running header/footer, grading list, schedule table and an exam period. */
export const US_OUTLINE: OutlineFixture = {
  id: 'us-outline',
  label: 'US multi-page syllabus (Northlake University, CS 1301)',
  timezone: 'America/New_York',
  referenceAt: AUG_2026,
  text: [
    `CS 1301: Introduction to Computing
Northlake University · Fall 2026 · Section A02
Instructor: Dr. A. Rivera (arivera@example.edu)
Teaching Assistants: J. Okafor (jokafor@example.edu), M. Chen
Lectures: MWF 10:10–11:00 AM, Hall 120
Recitations: Thursdays 3:30-4:20 pm
Instructor office hours: Tue/Thu 2:00–3:30 PM, Room 214
TA office hours: Wednesdays 1-2 PM, CS Lab
Page 1 of 3`,
    `CS 1301 · Fall 2026
Grading
Homework (8 x 4%) 32%
Quizzes 10%
Midterm Exam 23%
Final Exam 30%
Participation 5%
Total 100%
Late Work Policy
Academic Integrity
Assignments
Homework 1 released Aug 31, due Sept 11 at 11:59 PM ET (4%)
Homework 2 due Sept 25 at 11:59 PM ET
Quiz 1 (tentative): Oct 2
Midterm Exam: October 21, in class
Midterm Exam covers Weeks 1-7
Last day to drop without a W: September 4
Page 2 of 3`,
    `CS 1301 · Fall 2026
Week | Dates | Topic | Readings
Week 1 | Aug 31 | Course overview and Python basics | Ch. 1
Week 2 | Sep 7 | Variables and expressions | Ch. 2
Week 3 | Sep 14 | Conditionals | Ch. 3
Week 4 | Sep 21 | Loops | Ch. 4
No class: Monday, September 7 (Labor Day)
Final Exam: during the final exam period, Dec 8-17 (date set by the Registrar)
Final project due December 4 at 5:00 PM
Page 3 of 3`,
  ].join('\f'),
};

/** A Canadian course outline: table grading that does not add up, TBA final, a conflicting deadline, recurring tutorials. */
export const CA_OUTLINE: OutlineFixture = {
  id: 'ca-outline',
  label: 'Canadian course outline (Lakeshore University, COMP 202)',
  timezone: 'America/Toronto',
  referenceAt: AUG_2026,
  text: [
    `Lakeshore University
Department of Computer Science
COMP 202 – Foundations of Programming
Fall 2026, Section 001
Course Instructor: Prof. L. Tremblay, ltremblay@example.edu
Lectures: Tuesdays and Thursdays 2:35–3:55 PM
Office Hours: Monday 10:00-11:30 AM (Trottier 3104)
Method of Evaluation
Assessment | Weight | Date
Assignment 1 | 10% | September 25
Assignment 2 | 10% | October 18
Midterm (Chapters 1-4) | 25% | October 22
Final examination | 50% | TBA
Accommodations`,
    `Important dates
Assignment 2 due October 21
Tutorials every Thursday
Final examination date to be announced by the Registrar
Last day to withdraw: November 3
Reading week: October 12-16`,
  ].join('\f'),
};


/**
 * BIOL 115 regression fixture: RECONSTRUCTED from the facts reported about a
 * real McGill syllabus (the original file is not in this repository). It keeps
 * the reported imperfections: a Fall 2025 heading with 2026 dates, weekday/date
 * mismatches, deadlines tied to each student's assigned lecture, a final exam
 * with no date, a grading list that doesn't total 100%, a prerequisite line
 * naming BIOL 112, running headers/footers, and prose like "The midterm will be
 * written…" and "uploaded to myCourses Assignment 3 tab". Replace with the real
 * text when it is available.
 */
export const BIOL115_RECONSTRUCTED: OutlineFixture = {
  id: 'biol115-reconstructed',
  label: 'BIOL 115 (reconstructed McGill outline with conflicts)',
  timezone: 'America/Toronto',
  referenceAt: Date.UTC(2026, 7, 25, 16, 0),
  text: [
    `McGill University
Faculty of Science
BIOL 115 Essential Biology (3 credits)
Fall 2025 Course Outline
Instructors
Dr. Gemma de Martino (gemma.demartino@example.edu)
Dr. Sarah Woolley (sarah.woolley@example.edu)
Class schedule
Tuesdays and Thursdays, 8:35–9:55 AM
Location: McMed 522
Prerequisites and restrictions
BIOL 112 or equivalent may not be taken for credit with this course. Not open to students who have taken BIOL 112.
Course description
An introduction to the essential principles of biology for students without a background in the life sciences.
BIOL 115 · Fall 2025 · Page 1`,
    `BIOL 115 · Fall 2025 · Page 2
Evaluation
Assignment 1 – Multiple-choice questions and answers 5%
Assignment 2 – Fun Fact 10%
Assignment 3 – Literature Assignment A 15%
Assignment 4 – Literature Assignment B (video) 20%
Midterm exam 20%
Final exam
Assignment 1: Multiple-choice questions and answers (5%)
Write three multiple-choice questions, with answers, about the content of your assigned lecture.
Due five days after your assigned lecture, by 11:59 PM, through myCourses.
Assignment 2: Fun Fact (10%)
Find one surprising, well-sourced fact related to your assigned lecture topic and write a short paragraph explaining it.
The Fun Fact is due three days before your assigned lecture.
BIOL 115 · Fall 2025 · Page 2`,
    `BIOL 115 · Fall 2025 · Page 3
Assignment 3: Literature Assignment A (15%)
Read the assigned primary research article and write a 500-word summary of its research question, methods and main findings.
Your summary must be uploaded to myCourses Assignment 3 tab by November 24, 2026 at 11:59 PM.
Assignment 4: Literature Assignment B – Video (20%)
Create a 2.5–3 minute video presenting a research article of your choice.
Include the research question, methods, results, implications, and a creative component.
Submit the required reference document together with your video.
The video must be uploaded to myCourses Assignment 4 tab by Thursday, October 29 at 11:59 PM.
Midterm exam
The midterm will be written on Tuesday, October 20, from 7–9 PM. It covers lectures 1–10.
Final exam
The final exam will take place during the final examination period. The date will be set by Enrolment Services.
BIOL 115 · Fall 2025 · Page 3`,
    `BIOL 115 · Fall 2025 · Page 4
Late policy
Late assignments lose 10% per day, including weekends. Work submitted more than five days late will not be accepted.
Use of generative AI
Generative AI tools may not be used to write any part of a graded assignment. You may use them to check grammar only.
Academic integrity
McGill University values academic integrity. All students must understand the meaning and consequences of cheating, plagiarism and other academic offences.
Lecture schedule (tentative)
Tuesday, September 2 | Introduction: What is life?
Thursday, September 4 | Cells and organelles
Tuesday, September 9 | Membranes and transport
Thursday, September 11 | Energy and metabolism
Tuesday, September 16 | DNA structure and replication
BIOL 115 · Fall 2025 · Page 4`,
  ].join('\f'),
};

/** A UK-style module handbook: "Module", day-first numeric dates, "Coursework" and "Deadline" wording. */
export const UK_OUTLINE: OutlineFixture = {
  id: 'uk-outline',
  label: 'UK module handbook (Riverside University, ECON1002)',
  timezone: 'Europe/London',
  referenceAt: Date.UTC(2026, 8, 1, 9, 0),
  text: `Riverside University
ECON1002 Principles of Economics
Autumn 2026
Module leader: Dr. P. Okonkwo
Lectures: Mondays 10:00-11:00, Room LT2
Assessment
Coursework 1 (problem set) 20%
Coursework 2 (essay) 30%
Examination 50%
Coursework 1 deadline: 23/10/2026 at 12:00
Coursework 2 deadline: 27/11/2026 at 12:00
Examination: January examination period (date to be published)`,
};

export const OUTLINE_FIXTURES: readonly OutlineFixture[] = [US_OUTLINE, CA_OUTLINE, BIOL115_RECONSTRUCTED, UK_OUTLINE];
