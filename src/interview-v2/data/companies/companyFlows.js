export const COMPANY_ROUND_FLOWS = {
  amazon: [
    { id: 'resume-project', label: 'Resume + Project Discussion', domain: 'resume' },
    { id: 'dsa', label: 'DSA + Problem Solving', domain: 'problem-solving' },
    { id: 'system-design', label: 'System Design', domain: 'system-design' },
    { id: 'leadership', label: 'Leadership Principles', domain: 'behavioral' },
  ],
  google: [
    { id: 'resume-deep-dive', label: 'Resume Deep Dive', domain: 'resume' },
    { id: 'algorithms', label: 'Algorithms', domain: 'problem-solving' },
    { id: 'scalability', label: 'Scalability', domain: 'system-design' },
    { id: 'behavioral', label: 'Behavioral', domain: 'behavioral' },
  ],
  microsoft: [
    { id: 'resume-projects', label: 'Resume + Project Walkthrough', domain: 'resume' },
    { id: 'coding', label: 'Coding + DSA', domain: 'problem-solving' },
    { id: 'design', label: 'System Design', domain: 'system-design' },
    { id: 'culture', label: 'Collaboration + Growth Mindset', domain: 'behavioral' },
  ],
  tcs: [
    { id: 'aptitude', label: 'Aptitude + Reasoning', domain: 'aptitude' },
    { id: 'cs-fundamentals', label: 'CS Fundamentals', domain: 'technical' },
    { id: 'hr', label: 'HR Round', domain: 'hr' },
  ],
  infosys: [
    { id: 'aptitude', label: 'Aptitude + Logical Reasoning', domain: 'aptitude' },
    { id: 'technical', label: 'Technical + Fundamentals', domain: 'technical' },
    { id: 'managerial', label: 'Managerial + HR', domain: 'behavioral' },
  ],
  wipro: [
    { id: 'aptitude', label: 'Aptitude Assessment', domain: 'aptitude' },
    { id: 'technical', label: 'Technical Interview', domain: 'technical' },
    { id: 'hr', label: 'HR + Behavioral', domain: 'hr' },
  ],
}

export const DOMAIN_FLOW_ORDER = ['resume', 'project', 'technical', 'problem-solving', 'behavioral']
