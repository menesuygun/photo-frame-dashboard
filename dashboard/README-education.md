# Beyza’s Education dashboard

Open Education in the family dashboard sidebar. The simplified interface has Overview, Assignments, Discussions, Readings and Calendar. The Overview fits a landscape iPad; detailed sections scroll. Portrait uses stacked cards. Education stays open when idle; the sidebar screensaver works manually.

Course facts are separated in `js/education/course-data.js`; date/progress/storage validation is in `model.js`. Checkboxes persist per browser/device under `frame-education-beyza-v1`. Check again to undo. Submitted assignments disappear from Overview and remain available in Assignments.

Assignment deadlines are 11:55 PM America/Halifax, displayed in America/Toronto (10:55 PM for these deadlines). Real timezone rules handle DST. The exact Sunday discussion cutoff was not supplied; the dashboard shows Sunday dates only, flags unfinished work after the Sunday ends, and does not assume a precise submission time.

The seven discussion questions generate 35 weekday posts with stable question/date IDs. Optional readings do not count toward required progress. Nothing is automatically completed or cleared at a new unit. The supplied university logo is stored locally in public/assets/yorkville-university.png.

The separate syllabus/course-content documents were not attached. Reading titles are the brief’s descriptions, not fabricated full citations. Unavailable links stay unconfigured. Brightspace was verified against Yorkville’s official student handbook; APA links to the official APA Style site. This is not synchronized with Brightspace and does not submit coursework.

The user requested removal of the settings and grades interfaces. Versioned state validation retains compatibility with saved data for future expansion without exposing complex configuration screens.
