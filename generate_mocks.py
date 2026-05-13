import os
import shutil
import hashlib
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from docx import Document
from pypdf import PdfReader

# Text content definitions
A1_TEXT = """Nexora Inc.
Workplace Health and Safety Policy
Version 1.0
Effective Date: January 1, 2024

1. Purpose
The purpose of this Workplace Health and Safety Policy is to outline Nexora Inc.'s commitment to providing a safe, secure, and healthy work environment for all employees, contractors, visitors, and stakeholders. We believe that occupational health and safety is a fundamental aspect of our operations and crucial to the overall success and sustainability of the company. Nexora Inc. is fully committed to preventing workplace injuries, illnesses, and incidents by proactively identifying, assessing, and mitigating risks associated with our business activities.

2. Scope
This policy applies to all individuals working for or on behalf of Nexora Inc., including full-time, part-time, and temporary employees, as well as independent contractors, vendors, and visitors. It covers all Nexora Inc. facilities, remote work locations, company vehicles, and any off-site locations where company business is conducted. Compliance with this policy is a condition of employment and engagement with Nexora Inc.

3. Core Commitments
Nexora Inc. commits to the following key principles:
- Compliance: We will strictly adhere to all applicable local, national, and international health and safety laws, regulations, and industry standards.
- Risk Management: We will implement robust systems to identify hazards, assess risks, and implement effective control measures to eliminate or minimize risks to the lowest reasonably practicable level.
- Continuous Improvement: We will continually review and improve our health and safety performance through regular audits, inspections, and incident investigations.
- Training and Awareness: We will provide comprehensive and ongoing health and safety training to ensure that all individuals understand their roles, responsibilities, and the hazards associated with their work.
- Consultation and Participation: We will actively engage and consult with employees and their representatives on matters related to workplace health and safety.

4. Responsibilities
4.1 Executive Management
The Executive Management team is ultimately responsible for the health and safety of all personnel. They must allocate adequate resources, establish clear objectives, and demonstrate visible leadership in promoting a strong safety culture throughout the organization.
4.2 Managers and Supervisors
Managers and supervisors are responsible for ensuring that the work environments under their control are safe and compliant with this policy. They must ensure that hazards are identified and controlled, employees receive appropriate training, and safety rules are enforced consistently.
4.3 Employees and Contractors
All employees and contractors have a personal responsibility to work safely, follow established safety procedures, use provided protective equipment, and report any hazards, incidents, or near misses immediately to their supervisor or the safety department. No individual should ever perform a task they believe is unsafe.

5. Hazard Identification and Risk Assessment
Nexora Inc. requires proactive hazard identification and risk assessment prior to the commencement of any new project, introduction of new equipment or processes, or significant changes to existing operations. All identified hazards must be documented, and appropriate control measures must be implemented according to the hierarchy of controls (elimination, substitution, engineering controls, administrative controls, and personal protective equipment).

6. Incident Reporting and Investigation
All workplace incidents, accidents, injuries, illnesses, and near misses, regardless of severity, must be reported immediately. The Health and Safety Department will lead investigations into all reported events to determine root causes and implement corrective actions to prevent recurrence. Retaliation against any individual who reports a safety concern in good faith is strictly prohibited.

7. Emergency Preparedness and Response
Nexora Inc. will develop, implement, and maintain comprehensive emergency preparedness and response plans for all facilities. These plans will address potential emergencies such as fires, medical emergencies, natural disasters, and security threats. Regular drills and exercises will be conducted to ensure that all personnel are familiar with emergency procedures.

8. Workplace Violence and Harassment
Nexora Inc. is committed to providing a workplace free from violence, threats, intimidation, and harassment. We maintain a zero-tolerance policy for any form of workplace violence. Any individual engaging in such behavior will be subject to severe disciplinary action, up to and including termination of employment or contract, and potential legal action.

9. Alcohol and Drug Policy
The use, possession, distribution, or sale of illegal drugs or alcohol on company premises or while conducting company business is strictly prohibited. Employees must not report to work under the influence of any substance that may impair their ability to perform their duties safely.

10. Enforcement and Disciplinary Action
Compliance with this Workplace Health and Safety Policy is mandatory. Failure to adhere to these requirements may result in disciplinary action. The severity of the disciplinary action will be commensurate with the nature of the violation and may include verbal warnings, written warnings, suspension, or termination of employment.

11. Policy Review
This policy will be reviewed annually, or more frequently if required by changes in legislation, significant operational changes, or as a result of incident investigations.

12. Contractor Safety Management
Nexora Inc. expects all contractors to maintain the same high standards of health and safety as our own employees. Prior to engagement, contractors must undergo a rigorous safety pre-qualification process. Contractors are required to submit their own safety programs and site-specific safety plans for review and approval. Routine inspections and performance evaluations will be conducted to ensure ongoing compliance.

13. Occupational Health and Wellness
Beyond preventing physical injuries, Nexora Inc. is dedicated to supporting the overall physical and mental well-being of our workforce. We will provide access to occupational health services, employee assistance programs (EAP), and wellness initiatives designed to promote a healthy lifestyle and manage workplace stress. Ergonomic assessments will be available to all office and field personnel to prevent musculoskeletal disorders.

14. Environmental Health
Nexora Inc. recognizes the intrinsic link between occupational health and environmental stewardship. We are committed to minimizing the environmental impact of our operations through pollution prevention, waste reduction, and the responsible management of hazardous materials. Environmental health considerations will be integrated into all stages of our business planning and execution.

15. Communication
Effective communication is vital to a successful safety program. Nexora Inc. will ensure that safety information, including policies, procedures, hazard alerts, and performance metrics, is communicated clearly and regularly to all levels of the organization through various channels such as safety meetings, notice boards, intranets, and training sessions. Feedback and suggestions for improving safety are strongly encouraged.

Approved by:
Jane Doe
Chief Executive Officer
Nexora Inc.
"""

C1_TEXT = """Nexora Inc.
Corporate Safety and Health Directive
Edition 1.0
Activation Date: January 1st, 2024

1. Objective
The primary objective of this Corporate Safety and Health Directive is to detail Nexora Inc.'s dedication to cultivating a secure, protected, and wholesome operational setting for all staff members, independent contractors, guests, and shareholders. We consider workplace health and safety to be a core component of our business activities and essential to the long-term viability and achievements of our enterprise. Nexora Inc. is completely dedicated to averting occupational harm, sickness, and accidents by preemptively recognizing, evaluating, and addressing hazards connected to our commercial endeavors.

2. Applicability
This directive is mandatory for all persons performing duties for or representing Nexora Inc., encompassing full-time, part-time, and provisional workers, as well as external vendors, consultants, and visitors. It spans all Nexora Inc. physical sites, telecommuting setups, corporate fleet, and any external venues where company affairs take place. Adherence to this directive is a prerequisite for continued employment or association with Nexora Inc.

3. Primary Pledges
Nexora Inc. is devoted to the succeeding fundamental tenets:
- Regulatory Observance: We shall rigorously comply with all pertinent municipal, state, and global health and safety legislation, rules, and sector norms.
- Hazard Mitigation: We shall establish strong frameworks to pinpoint dangers, evaluate threats, and enact potent safeguards to eradicate or reduce risks to the minimum practically achievable degree.
- Unceasing Enhancement: We shall constantly assess and better our health and safety metrics via systematic reviews, facility checks, and accident inquiries.
- Education and Comprehension: We shall supply extensive and continuous safety training to guarantee that all personnel grasp their duties, obligations, and the perils linked to their specific tasks.
- Collaboration and Involvement: We shall deliberately interact and confer with staff and their delegates regarding issues tied to occupational health and well-being.

4. Accountabilities
4.1 Senior Leadership
The Senior Leadership group bears ultimate accountability for the physical welfare of all workforce members. They are required to dispense sufficient funding, set unambiguous targets, and showcase transparent guidance in fostering a solid culture of safety across the firm.
4.2 Directors and Team Leaders
Directors and team leaders are accountable for making certain that the operational spaces under their supervision are secure and in accordance with this directive. They must verify that dangers are spotted and mitigated, staff obtain proper instruction, and safety guidelines are applied uniformly.
4.3 Personnel and Vendors
Every worker and vendor carries a personal duty to operate securely, abide by defined safety protocols, utilize supplied protective gear, and escalate any dangers, accidents, or close calls instantly to their superior or the safety unit. No person should ever execute an assignment they deem hazardous.

5. Danger Recognition and Threat Evaluation
Nexora Inc. mandates preemptive danger recognition and threat evaluation before the start of any fresh endeavor, the rollout of novel machinery or methods, or substantial alterations to current processes. All spotted dangers must be recorded, and suitable safeguards must be enacted in alignment with the safety control hierarchy (removal, replacement, mechanical safeguards, procedural safeguards, and personal protective equipment).

6. Event Notification and Analysis
All occupational accidents, mishaps, wounds, diseases, and close calls, no matter how minor, must be escalated right away. The Safety and Health Unit will spearhead analyses into all escalated incidents to pinpoint underlying causes and enact remedial steps to stop them from happening again. Any form of reprisal directed at a person who voices a safety worry truthfully is absolutely forbidden.

7. Crisis Readiness and Action
Nexora Inc. shall formulate, execute, and keep up comprehensive crisis readiness and action strategies for all premises. These strategies will cover possible crises like blazes, health emergencies, acts of nature, and security hazards. Periodic practice runs and simulations will be organized to guarantee that all staff are conversant with crisis protocols.

8. Workplace Aggression and Bullying
Nexora Inc. is resolute in maintaining a work environment completely devoid of aggression, intimidation, coercion, and bullying. We uphold a zero-tolerance stance regarding any type of workplace aggression. Any person partaking in such actions will face harsh punitive measures, potentially culminating in job or contract termination, and possible lawful recourse.

9. Substance and Intoxicant Rule
The utilization, ownership, distribution, or vending of illicit narcotics or intoxicants on firm property or while engaged in company duties is categorically forbidden. Personnel must not arrive for duty while affected by any substance that might compromise their capacity to execute their tasks securely.

10. Application and Disciplinary Measures
Adherence to this Corporate Safety and Health Directive is compulsory. Neglect in following these stipulations may prompt disciplinary measures. The gravity of the disciplinary measure will correspond to the character of the infraction and might involve spoken cautions, formal reprimands, temporary removal, or dismissal from employment.

11. Directive Re-evaluation
This directive shall be re-evaluated on a yearly basis, or sooner if necessitated by shifts in law, major procedural changes, or stemming from accident analyses.

12. Vendor Safety Supervision
Nexora Inc. demands all vendors to uphold the equivalent stringent levels of health and safety as our direct personnel. Before beginning work, vendors must complete a strict safety vetting procedure. Vendors are mandated to hand in their distinct safety plans and site-tailored safety schemes for checking and authorization. Regular checks and performance reviews will be carried out to verify sustained adherence.

13. Workplace Wellness and Health
Beyond averting bodily harm, Nexora Inc. is devoted to backing the holistic physical and psychological well-being of our staff. We shall grant access to occupational health facilities, employee support schemes (EAP), and wellness drives intended to foster a healthy way of life and cope with job-related tension. Posture and workstation evaluations will be open to all desk and field staff to avert musculoskeletal issues.

14. Ecological Well-being
Nexora Inc. acknowledges the fundamental connection between workplace health and ecological responsibility. We are resolute in decreasing the ecological footprint of our processes via pollution avoidance, trash reduction, and the careful handling of dangerous substances. Ecological health factors will be woven into all phases of our corporate strategizing and implementation.

15. Information Sharing
Clear information sharing is crucial to an effective safety scheme. Nexora Inc. will make sure that safety data, encompassing rules, protocols, danger warnings, and performance indicators, is disseminated transparently and routinely to all tiers of the firm via diverse mediums like safety gatherings, announcement boards, internal networks, and instruction modules. Input and recommendations for enhancing safety are heavily welcomed.

Endorsed by:
John Smith
Chief Operating Officer
Nexora Inc.
"""

C2_TEXT = A1_TEXT.replace("January 1, 2024", "February 1, 2024")
C2_TEXT = C2_TEXT.replace("Version 1.0", "Version 1.1")
C2_TEXT = C2_TEXT.replace("Jane Doe", "Michael Chang")
C2_TEXT = C2_TEXT.replace("Chief Executive Officer", "VP of Operations")
C2_TEXT = C2_TEXT.replace("health and safety", "health, safety, and wellness")
C2_TEXT = C2_TEXT.replace("Workplace Health and Safety Policy", "Workplace Health, Safety, and Wellness Policy")

D1_TEXT = """Nexora Inc.
Corporate Data Retention and Disposal Policy
Version 2.0
Effective Date: March 15, 2024

1. Purpose
The purpose of this Data Retention and Disposal Policy is to ensure that Nexora Inc. retains its official records in accordance with all applicable legal, regulatory, and business requirements. Furthermore, this policy ensures that records are securely destroyed or permanently deleted when they reach the end of their required retention period. Proper data management reduces storage costs, optimizes information retrieval, and mitigates legal and privacy risks associated with retaining obsolete data.

2. Scope
This policy applies to all physical and electronic records generated, received, or maintained by Nexora Inc. in the course of its business operations. It applies to all employees, contractors, temporary staff, and third-party vendors who have access to Nexora Inc. data.

3. Record Categories and Retention Periods
Nexora Inc. categorizes its data into several groups, each with specific retention requirements.
3.1 Financial and Accounting Records
All tax returns, general ledgers, financial statements, and supporting documentation (invoices, receipts, bank statements) must be retained for a period of seven (7) years from the end of the fiscal year to which they relate.
3.2 Human Resources Records
Employee personnel files, performance evaluations, and payroll records must be retained for the duration of employment plus six (6) years following termination. Medical records and workers' compensation claims must be retained for thirty (30) years.
3.3 Corporate and Legal Documents
Articles of incorporation, bylaws, board meeting minutes, and corporate seals must be retained permanently. Major contracts and agreements must be retained for ten (10) years after their expiration or termination.
3.4 Routine Correspondence
General email communications and internal memos that do not constitute official business records should be deleted when they are no longer needed for immediate reference, typically within one (1) year.

4. Legal Hold
In the event of pending or reasonably anticipated litigation, government investigation, or audit, the Legal Department will issue a "Legal Hold" notice. A Legal Hold overrides all standard retention periods and disposal schedules. Upon receiving a Legal Hold notice, employees must immediately suspend the destruction of any related documents, including routine emails, until the hold is officially released by the Legal Department in writing.

5. Data Disposal and Destruction
When records reach the end of their retention period and are not subject to a Legal Hold, they must be securely destroyed.
5.1 Physical Records
Paper documents containing confidential, proprietary, or personally identifiable information (PII) must be shredded using cross-cut shredders or placed in designated secure shredding bins for certified vendor disposal. Throwing sensitive documents into standard recycling or trash bins is strictly prohibited.
5.2 Electronic Records
Digital files must be permanently deleted from all systems, including servers, local hard drives, cloud storage, and backup tapes. For hardware that is being retired or repurposed, storage media must be securely wiped using approved data sanitization software or physically destroyed if wiping is not feasible.

6. Compliance and Auditing
The Information Technology (IT) and Legal departments will conduct periodic audits to ensure compliance with this policy. Violations of this Data Retention and Disposal Policy may result in disciplinary action up to and including termination, as well as potential legal penalties for the company.

Approved by:
Sarah Jenkins
General Counsel
Nexora Inc.

Additional padding for length requirement:
To meet the minimum word count for testing, this policy also covers the retention schedules for ancillary systems. The retention of security camera footage is set at ninety (90) days unless a specific incident requires preservation. Building access logs are kept for one (1) year. Visitor registration logs are maintained for three (3) years. Any data stored on removable media such as USB drives must adhere to the same retention rules as server-based data. Removable media must be encrypted and physically destroyed at the end of its useful life. Training records for all employees regarding data privacy and security will be kept for five (5) years to demonstrate compliance during external audits. The Data Protection Officer (DPO) will review these schedules annually and make necessary adjustments to align with new data privacy regulations. Furthermore, any exceptions to these retention schedules must be formally documented and approved by both the DPO and the Legal Department.
"""

# Boilerplate ~9000 words (9000 words * ~6 chars = ~54,000 chars).
BOILERPLATE_TEXT = "This is an appendix section containing standardized boilerplate text meant to pad the document length for testing purposes. " * 800

def create_pdf(filename, text):
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    style = styles["Normal"]
    story = []
    for paragraph in text.split('\\n'):
        if paragraph.strip():
            # ReportLab requires <br/> instead of \\n for simple text or just separate paragraphs
            p = Paragraph(paragraph.strip(), style)
            story.append(p)
            story.append(Spacer(1, 0.1 * inch))
    doc.build(story)

def create_empty_pdf(filename):
    c = canvas.Canvas(filename, pagesize=letter)
    c.showPage()
    c.save()

def extract_pdf_text(filename):
    reader = PdfReader(filename)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\\n"
    return text

def create_docx(filename, text):
    doc = Document()
    for paragraph in text.split('\\n'):
        if paragraph.strip():
            doc.add_paragraph(paragraph.strip())
    doc.save(filename)

def create_txt(filename, text):
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(text)

def main():
    out_dir = os.path.join(os.path.dirname(__file__), 'mock_docs')
    os.makedirs(out_dir, exist_ok=True)
    
    print("Generating A1...")
    a1_path = os.path.join(out_dir, 'original_safety_policy.pdf')
    create_pdf(a1_path, A1_TEXT)
    
    print("Extracting A1 text...")
    extracted_a1 = extract_pdf_text(a1_path)
    
    print("Generating A2...")
    a2_path = os.path.join(out_dir, 'original_safety_policy_copy.pdf')
    shutil.copy(a1_path, a2_path)
    
    print("Generating B1 and B2...")
    b1_path = os.path.join(out_dir, 'safety_policy_v1.docx')
    b2_path = os.path.join(out_dir, 'safety_policy_v1.txt')
    create_docx(b1_path, extracted_a1)
    create_txt(b2_path, extracted_a1)
    
    print("Generating C1 and C2...")
    c1_path = os.path.join(out_dir, 'safety_policy_paraphrase.pdf')
    c2_path = os.path.join(out_dir, 'safety_policy_light_edit.pdf')
    create_pdf(c1_path, C1_TEXT)
    create_pdf(c2_path, C2_TEXT)
    
    print("Generating D1...")
    d1_path = os.path.join(out_dir, 'data_retention_policy.pdf')
    create_pdf(d1_path, D1_TEXT)
    
    print("Generating E1...")
    e1_path = os.path.join(out_dir, 'empty_document.pdf')
    create_empty_pdf(e1_path)
    
    print("Generating E2...")
    e2_path = os.path.join(out_dir, 'large_document.pdf')
    # Using A1_TEXT to ensure exact match of the first 4000 characters
    e2_text = A1_TEXT + "\\n\\nAppendix A\\n\\n" + BOILERPLATE_TEXT
    create_pdf(e2_path, e2_text)
    
    print("Generating MANIFEST.md...")
    manifest_path = os.path.join(out_dir, 'MANIFEST.md')
    files_info = [
        ('original_safety_policy.pdf', 'A1', 'Baseline document for Layer 1.'),
        ('original_safety_policy_copy.pdf', 'A2', 'Exact byte-level duplicate (Layer 1 hit).'),
        ('safety_policy_v1.docx', 'B1', 'Same extracted text, different format (Layer 2 hit).'),
        ('safety_policy_v1.txt', 'B2', 'Same extracted text, raw format (Layer 2 hit).'),
        ('safety_policy_paraphrase.pdf', 'C1', 'Paraphrased text, >0.95 semantic similarity (Layer 3 hit).'),
        ('safety_policy_light_edit.pdf', 'C2', 'Lightly edited text, >0.98 semantic similarity (Layer 3 hit).'),
        ('data_retention_policy.pdf', 'D1', 'Completely new document (No hit, passes deduplication).'),
        ('empty_document.pdf', 'E1', 'PDF with no extractable text (Layer 2/3 empty text edge case).'),
        ('large_document.pdf', 'E2', 'Large document with first 4000 chars matching A1 (Layer 3 partial hit test).')
    ]
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        f.write("# Mock Documents Manifest\n\n")
        f.write("| Filename | Scenario | Target Deduplication Layer | SHA-256 Checksum |\n")
        f.write("|----------|----------|----------------------------|------------------|\n")
        for fname, scenario, desc in files_info:
            fpath = os.path.join(out_dir, fname)
            with open(fpath, 'rb') as doc_file:
                checksum = hashlib.sha256(doc_file.read()).hexdigest()
            f.write(f"| `{fname}` | {scenario} | {desc} | `{checksum}` |\n")
    print("Done!")

if __name__ == '__main__':
    main()
