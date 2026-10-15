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

export const OUTLINE_FIXTURES: readonly OutlineFixture[] = [US_OUTLINE, CA_OUTLINE];
