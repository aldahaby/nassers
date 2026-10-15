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


/**
 * BIOL 115 LAYOUT fixture: written in our own words, but laid out like the real
 * McGill syllabus text a student imported (the real file is copyrighted course
 * material and is never committed; see fixtures/private/). It keeps the real
 * layout traps: a title-case code after the title, a restriction wrapped onto a
 * line that starts with another course code, names under an "Instructors'
 * information" heading with "Email:" lines, TAs side by side, a PDF lecture
 * table whose topics wrap above and below the date, weights on "Value:" lines,
 * a publication cut-off date and a citation date inside an assignment, a midterm
 * and final described only in prose, and a "Fall 2025" heading while the dates
 * fit 2026.
 */
export const BIOL115_LAYOUT: OutlineFixture = {
  id: 'biol115-layout',
  label: 'BIOL 115 (real layout, own wording)',
  timezone: 'America/Toronto',
  referenceAt: Date.UTC(2026, 7, 25, 13, 0),
  text: [
    `                                  Essential Biology, Biol 115
General information
Term and year: Fall 2025
Restrictions: For students outside the Faculty of Science; not for those who completed BIOL 111,
                                                BIOL 112, or equivalents.
Course schedule: Tuesday and Thursdays; 8:35 – 9:55 AM in McMed 522
Number of credits: 3 credits

Instructors' information
 Dr. Gemma de Martino (instructor & course coordinator)
 Email: gdm@example.edu
 Office location: N3/2

 Dr. Sarah Woolley (instructor & TA coordinator)
 Email: sw@example.edu

 Teaching assistants (TAs)
 Aleksei Sychterz                               Sabrina Percy
 Email: as@example.edu                          Email: sp@example.edu

Ev Berger-Wolf
Email: ebw@example.edu

Communicating with instructors:
Post content questions on the discussion board first.
                                                                                                         1`,
    `The midterm will be written OCT 20 from 7- 9 PM (outside class time). Rooms will be posted
in early October.

The final exam will cover material only presented after the midterm and will be written during the final
exam period.

All exams will only cover lecture material and use multiple-choice questions.

Course policies on deadlines
Deadlines help TAs return feedback quickly.
For assignment 2 (Fun Fact) - it must be in at least 3 days before the lecture. Late assignments lose 10% per day.
For assignments 1, 3 and 4, each student has a late "bank" of 6 days for the semester.

Course policies on Generative AI
Students may use generative AI tools as learning aids, but remain accountable for their work.
                                                                                                            2`,
    `Course content & key milestones

Date     Day     Lectures Topic                         Assignments

                          Welcome and course overview,
1-Sep    Tues
                          meet the instructors          Lit.A & B start

                          Scientific Method
3-Sep    Thurs   Lect.1
                          (Woolley)

                          MODULE 1: Life, Diversity,
                          and Evolution (Woolley)

                          Fundamentals of Evolution:
8-Sep    Tues    Lect.2
                          Natural Selection

                          Fundamentals of Evolution:
10-Sep   Thur    Lect.3
                          Sexual Selection

                                                     Fun fact and Q&A assignments start with
                          Fundamentals of Evolution: lecture 4 on Sep 15. Check your group number.
15-Sep   Tues    Lect.4
                          Drift and adaptation

                           Brain Evolution: Evolution of
29-Sep   Tues
                 Lect. 8   Language

13-Oct   Tues              Fall Break

                          The Chemistry of Life:
20-Oct   Tues   Lect.11
                          Water and Macromolecules Midterm Exam on Modules 1 & 2 at 7

                          Cellular Energy
29-Oct   Thur   Lect.14
                          &Respiration                Deadline for LitB video Oct.29

                          Complex Inheritance and
24-Nov   Tues   Lect.21
                          Human Genetics (Sychterz) Deadline for LitA short essay Nov 24
                                                                                           3`,
    `McGill policy statements
-   Language of submission
    Students may submit graded written work in English or French. (Approved by Senate on 21 January 2009)
-   Academic integrity
    McGill University values academic integrity. See McGill University's guide to academic honesty.

Assignments
Instructions and rubrics for each assignment follow.

Assignment 1 – Multiple choice questions and answers

The purpose of this assignment is to check your understanding of the lecture by writing
two multiple choice questions (with answers).

Value: 5% of final grade

Submission: Online through myCourses as a PDF or Word document

Deadline: Always due at 11:59 PM, 5 days after the assigned lecture is presented. Upload to myCourses
Assignment 1 tab

Lectures are assigned to individuals in myCourses -> Groups -> Multiple Choice

The bank of extension dates is applicable for this assignment.

Grading Scheme for multiple choice Q&A (per question and answers):
 Clarity /0.5 per question

Assignment 2 - Fun Fact Assignment

You will be assigned a lecture to present a fun fact slide about.

Value: 10% of final grade

Deadline: Always due at 11:59 PM, 3 days BEFORE the assigned lecture so that it can be presented in
class. Upload to myCourses Assignment 2 tab

Lectures are assigned via the Groups tab on myCourses - Consult the FUN FACT groups

A late penalty of 10% per day will apply to this assignment. The bank of extension dates is NOT applicable.

Grading Scheme for fun fact assignment ( /10 total)
                                                                                                            4`,
    `Assignment 3 – Literature assignment A

Find a biology news item published since January 1, 2026 and evaluate how reliable its source is.

Value: 15% of final grade

Deadline: November 24, by 11:59 PM uploaded to myCourses Assignment 3 tab.

Grading Scheme for Lit A Assignment ( /15 total)
 Signed up for article by Sept 11 /0.5

Assignment 4 – Literature assignment B: News Article Video Assignment

Make a 2.5–3 minute video explaining a recent finding from a news article.

Example reference: Writer, A. (2021, September 14). A science story. Science News.

Value: 20% of final grade

Submission: Online through myCourses in Assignment 4 tab.

Deadline: October 29th, 2026, at 11:59 PM uploaded to myCourses Assignment 4 tab

The bank of extension dates is applicable for this assignment.

Grading Scheme for Lit B assignment:
                                                                                                            5`,
  ].join('\f'),
};

export const OUTLINE_FIXTURES: readonly OutlineFixture[] = [US_OUTLINE, CA_OUTLINE, BIOL115_RECONSTRUCTED, BIOL115_LAYOUT, UK_OUTLINE];
