// Reference blink rates (blinks per minute) and the band cut-offs. The only place these numbers live.
//
// Sources, checked on 2026-10-18. Read in full: the AAO page. Read as abstract or secondary reports only
// (PubMed and the publishers' sites blocked automated fetching): the three papers. Check the papers before
// quoting exact figures on stage.
//
// 1. AAO: "Computers, Digital Devices, and Eye Strain", American Academy of Ophthalmology, published
//    27 Jun 2024, reviewed by James M Huffman MD. https://www.aao.org/eye-health/tips-prevention/computer-usage
//    "Humans normally blink about 15 times in one minute." and "we only blink about 5 to 7 times in a minute
//    while using computers and other digital screen devices". It names no primary study for either figure.
// 2. Bentivoglio et al., "Analysis of blink rate patterns in normal subjects", Movement Disorders 1997;12(6):1028-1034,
//    doi:10.1002/mds.870120629. 150 healthy volunteers: about 17 blinks/min at rest, about 26 in conversation,
//    about 4.5 while reading (printed text, not a screen).
// 3. Talens-Estarelles et al., "Blinking kinematics characterization during digital displays use", Graefes Arch
//    Clin Exp Ophthalmol 2021 (PMC8913463): 20.4 blinks/min looking at a distant target against 9.8 on a computer
//    (95% CI 6.9 to 12.8), a 45 to 55% drop on all displays.
// 4. Chu, Rosenfield & Portello, "Blink patterns: reading from a computer screen versus hard copy", Optometry and
//    Vision Science 2014 (PubMed 24413278): 20 minutes of reading gave 14.9 blinks/min on a computer and 13.6 on paper,
//    not significantly different, and more incomplete blinks on screen (7.0% against 4.3%).
//
// What this means: 15 to 20 at rest is well supported (sources 1, 2, 3). 5 to 7 on screen is the AAO's figure and
// sits at the low end: the controlled studies above found about 10 (source 3) and about 15 (source 4) while reading
// on a screen. Say "published ranges vary" if asked.
export interface Range {
  label: string
  min: number
  max: number
  cite: string // short label shown in the chart legend
  source: string
}

export const RELAXED_RANGE: Range = {
  label: 'Relaxed, not at a screen',
  min: 15,
  max: 20,
  cite: 'AAO, Bentivoglio 1997',
  source: 'Sources 1 to 3 above: AAO "about 15", Bentivoglio about 17 at rest, Talens-Estarelles 20.4 for a distant target.',
}

export const SCREEN_RANGE: Range = {
  label: 'Typical at a screen',
  min: 5,
  max: 7,
  cite: 'AAO',
  source: 'Source 1 above only (AAO "5 to 7"). Sources 3 and 4 found about 10 and about 15 on screen, so published values vary.',
}

// Band cut-offs. NOT from a source: chosen by the AI, because PROJECT.md asks for low / typical / high but does not
// say where the lines go. Low is below the bottom of the screen-use range, high is above the top of the relaxed
// range, and everything between is typical.
export const LOW_BELOW = SCREEN_RANGE.min
export const HIGH_ABOVE = RELAXED_RANGE.max

export type Band = 'low' | 'typical' | 'high'

export function bandFor(blinksPerMinute: number): Band {
  if (blinksPerMinute < LOW_BELOW) return 'low'
  if (blinksPerMinute > HIGH_ABOVE) return 'high'
  return 'typical'
}
