from typing import Annotated
import os
from typing import TypedDict, Literal
import json
from pathlib import Path
import io
import re
from apify_client import ApifyClient
import gradio as gr
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langgraph.graph import StateGraph
from typing_extensions import TypedDict
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import ToolNode
from langchain_core.tools import StructuredTool
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel
from langchain_core.messages import ToolMessage
from PyPDF2 import PdfReader
import uuid

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from bs4 import BeautifulSoup

load_dotenv(override=True)

BASE_DIR = Path(__file__).resolve().parent
GENERATED_DIR = BASE_DIR / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

memory = MemorySaver()
llm = ChatOpenAI(model="gpt-4o-mini")


########### CLASS AND OBJECTS ###################
class Job(TypedDict):
    title: str
    company_link: str | None
    location: str
    salary: list
    advantage: str
    description: str
    seniority_level: str


class Input(BaseModel):
    role: str
    location: str
    # Job:object


class State(TypedDict):
    messages: Annotated[list, add_messages]
    html: str
    resume: bool
    job: str
    job_mode: bool
    intent: Literal["chat", "job_chat", "resume"]
    pdf: str
    pdf_input: bool
    pdf_input_text: str


class Profile(BaseModel):
    url: str


####### APIFY TOKENS EVERYTHING ###########
APIFY_TOKEN = os.getenv("APIFY_API_TOKEN")
ACTOR_ID = "apify~linkedin-jobs-scraper"
client = ApifyClient(APIFY_TOKEN) if APIFY_TOKEN else None
ACTOR2_ID = "giovannibiancia~linkedin-easy-apply"
LINKEDIN_PROFILE_SCRAPER = "ahmed-khaled~linkedin-profile-details-scraper"


def _message_to_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


def _get_weasyprint_html():
    try:
        from weasyprint import HTML
        return HTML, None
    except Exception as exc:
        return None, exc


def _wrap_text(text, max_chars):
    words = text.split()
    if not words:
        return [""]

    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _html_to_resume_lines(html_text):
    soup = BeautifulSoup(html_text, "html.parser")
    body = soup.body or soup

    lines = []
    for node in body.find_all(["h1", "h2", "h3", "p", "li", "div"]):
        text = " ".join(node.get_text(" ", strip=True).split())
        if not text:
            continue

        tag = node.name.lower()
        if tag == "h1":
            lines.append(("title", text))
        elif tag in {"h2", "h3"}:
            lines.append(("section", text.upper()))
        elif tag == "li":
            lines.append(("bullet", f"- {text}"))
        else:
            lines.append(("body", text))

    deduped = []
    seen = set()
    for kind, text in lines:
        key = (kind, text)
        if key in seen:
            continue
        seen.add(key)
        deduped.append((kind, text))
    return deduped


def _pdf_escape(text):
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf_bytes(pages):
    objects = []

    def add_object(content):
        objects.append(content)
        return len(objects)

    font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>")
    bold_font_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    page_ids = []
    content_ids = []

    for page in pages:
        stream = page.encode("latin-1", errors="replace")
        content_id = add_object(
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"\nendstream"
        )
        content_ids.append(content_id)
        page_ids.append(None)

    kids_refs = []
    pages_id_placeholder = len(objects) + 1
    for i, content_id in enumerate(content_ids):
        page_obj = (
            f"<< /Type /Page /Parent {pages_id_placeholder} 0 R "
            f"/MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_id} 0 R /F2 {bold_font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode("latin-1")
        page_id = add_object(page_obj)
        page_ids[i] = page_id
        kids_refs.append(f"{page_id} 0 R")

    pages_id = add_object(
        f"<< /Type /Pages /Count {len(page_ids)} /Kids [{' '.join(kids_refs)}] >>".encode("latin-1")
    )
    catalog_id = add_object(f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("latin-1"))

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{idx} 0 obj\n".encode("latin-1"))
        output.extend(obj)
        output.extend(b"\nendobj\n")

    xref_offset = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode("latin-1")
    )
    return bytes(output)


def _write_simple_pdf_from_html(html_text, pdf_path):
    parsed_lines = _html_to_resume_lines(html_text)
    pages = []
    current = ["BT"]
    y = 760
    page_line_budget = 0

    def flush_page():
        nonlocal current, y, page_line_budget
        current.append("ET")
        pages.append("\n".join(current))
        current = ["BT"]
        y = 760
        page_line_budget = 0

    for kind, raw_text in parsed_lines:
        if kind == "title":
            wrapped = _wrap_text(raw_text, 38)
            font = "F2"
            size = 18
            leading = 24
        elif kind == "section":
            wrapped = _wrap_text(raw_text, 60)
            font = "F2"
            size = 12
            leading = 18
        elif kind == "bullet":
            wrapped = _wrap_text(raw_text, 82)
            font = "F1"
            size = 10
            leading = 14
        else:
            wrapped = _wrap_text(raw_text, 90)
            font = "F1"
            size = 10
            leading = 14

        for line in wrapped:
            if y < 40:
                flush_page()
            current.append(f"/{font} {size} Tf 40 {y} Td ({_pdf_escape(line)}) Tj")
            y -= leading
            page_line_budget += 1
        y -= 4

    if len(current) > 1:
        flush_page()

    pdf_bytes = _build_simple_pdf_bytes(pages or ["BT\n/F1 12 Tf 40 760 Td (Resume unavailable.) Tj\nET"])
    with open(pdf_path, "wb") as pdf_file:
        pdf_file.write(pdf_bytes)


####### ALL THE FUNCTIONS ###############
def extract_text_from_pdf(pdf_file):
    reader = PdfReader(pdf_file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    print("PDF Text:", text)
    return text.strip()


######## Resume Builder ###########
def resume(state: State):
    last = ""
    if state.get("pdf_input_text"):
        last = state["pdf_input_text"]
        print("✅ Using PDF resume content")
    else:
        for msg in reversed(state["messages"]):
            if isinstance(msg, HumanMessage):
                print("Human Message Called")
                content = _message_to_text(msg.content).strip()
                if len(content) > 100:   # <-- CRITICAL FILTER
                    last = content
                    print("✅ Using manual resume content")
                    break

    # Safety check
    if not last:
        print("No resume content found")
        return {
            "messages": [AIMessage(content="Please upload a resume PDF or paste your resume text.")],
            "resume": True,
            "intent": "resume"
        }
    res = state.get("job")
    state["resume"] = False
    HTML, weasyprint_error = _get_weasyprint_html()
    system = f"""
    These are the jobs the user is applying for:
    {res}
    You are a senior FAANG resume engineer who designs resumes for Google, Meta, Amazon, Apple, and Netflix.
    You have been given the user's resume content: {state.get("pdf_input_text")}
    You have been given:
    • The user’s raw personal information: {last}
    • Job descriptions scraped by you: {res}
    Your task is to generate a FAANG-level ONE-PAGE resume that visually, structurally, and spatially matches a classic Stanford /  FAANGPath resume layout.
    ────────────────────────────────
    ABSOLUTE CONSTRAINTS (DO NOT VIOLATE)
    ────────────────────────────────
    • Do NOT change the candidate’s name
    • Do NOT fabricate experience
    • Do NOT invent companies, dates, or roles
    • Use ONLY information present or reasonably inferred from user input
    • Resume MUST fill the page vertically (no large blank bottom space)
    • Resume MUST look dense but readable (like FAANGPath)
    ────────────────────────────────
    CONTENT & DENSITY RULES
    ────────────────────────────────
    • Every section must contribute vertical density
    • ALL other sections MUST use bullet points.
    • NO section may contain paragraph-style text.
    • Every bullet MUST be a single line only.
    • If a sentence exceeds one line, rewrite it shorter
    • Avoid short sections with 1–2 lines unless unavoidable
    • Expand bullets with meaningful technical detail where possible
    SECTION LIMITS:
    • Objective: 3–4 lines (NOT 1 line)
    • Education: 2 entries minimum, include specialization/context
    • Skills: Grouped labels (Languages, Frameworks, Tools,SoftSkills) minimum 2 lines
    • Experience:
      - MAX 4 bullets per role
      - Bullets must be descriptive (not shallow)
    • Projects:
      - MAX 3 projects (if no projects, then don't include this section) (dont make up projects if no projects are found in the resume)
      - Each project: 5–6 dense bullet points
    • No empty lines between sections
    ────────────────────────────────
    BULLET RULES
    ────────────────────────────────
    • Start every bullet with a strong action verb
    • Every bullet should imply impact or learning
    • Avoid generic phrases (“worked on”, “helped with”)
    • Prefer technical depth over fluff
    ────────────────────────────────
    LAYOUT RULES (CRITICAL)
    ────────────────────────────────
    Follow EXACT FAANGPath ordering:
    1. Name (centered, large)
    2. Contact info (centered,Create Links if Necessary Two line)
    3. Objective (Leave Some vertical Space , dense, professional)
    4. Education (degree + specialization inline)
    5. Skills (bold labels + inline values)
    6. Experience
       - Role + Company (left-aligned,bold)
       - Dates + Location (right-aligned)
       - Bullets directly below (aligned to the Role + Company)
    7. Projects
       - Project name in bold
       - Description directly below (NO extra spacing,bullets preferred)
    8. Extra-Curricular (Based on the Profile)
    9.Leadership (1–2 dense lines) (Based on My Experience)
    ────────────────────────────────
    TYPOGRAPHY & SPACING CONTROL
    ────────────────────────────────
    The resume MUST visually resemble FAANGPath:
    • Section headers should NOT appear oversized
    • Body text must feel compact and continuous
    • Avoid excessive margin collapse
    • Lines should visually “flow” down the page
    ────────────────────────────────
    STYLE RULES
    ────────────────────────────────
    • Output ONLY valid HTML
    • Include CSS inside a <style> tag
    • NO markdown
    • NO explanations
    • NO emojis
    • NO icons
    • NO tables
    • Black/gray only
    • Fonts: Times New Roman, Arial, Helvetica ONLY
    ────────────────────────────────
    PAGE SETUP (MANDATORY — DO NOT CHANGE)
    ────────────────────────────────
    @page
    size: 794px 1123px;
    margin: 26px;
    body
    font-size: 14px;
    line-height: 1.25;
    li
    margin-bottom: 2px;
    ────────────────────────────────
    SECTION HEADER STYLE
    ────────────────────────────────
    • Font size: 16px (NOT bigger)
    • Font weight: 700
    • Letter spacing: 0.4px
    • Margin-top: 8px
    • Margin-bottom: 2px
    • Uppercase
    • Thin horizontal line underneath
    ────────────────────────────────
    FINAL OUTPUT RULES
    ────────────────────────────────
    • Output ONLY the final HTML resume
    • No commentary
    • No tool calls
    • Remove```html fences
    • No placeholder text
    • The page must visually resemble FAANGPath"""
    response = llm.invoke([HumanMessage(content=system)])
    final_html = _message_to_text(response.content).replace("```html", "").replace("```", "")
    pdf_name = str(uuid.uuid4()) + ".pdf"
    pdf_path = GENERATED_DIR / pdf_name
    state["pdf_input"] = False
    if HTML is not None:
        HTML(string=final_html).write_pdf(str(pdf_path))
        success_message = "✅ Your resume is ready. Download it below."
    else:
        _write_simple_pdf_from_html(final_html, pdf_path)
        success_message = (
            "✅ Your resume PDF is ready. "
            f"(Using simplified PDF rendering because WeasyPrint is unavailable: {weasyprint_error})"
        )
    return {
        "messages": [AIMessage(content=success_message)],
        "html": response.content,
        "resume": False,
        "intent": "chat",
        "pdf": pdf_name
    }


#### Fetching the Jobs ######
def fetch_linkedin_jobs(role: str, location: str):
    print("Fetch job activated")
    if not APIFY_TOKEN or client is None:
        raise ValueError("APIFY_API_TOKEN is not configured.")
    run_input = {
        "urls": [
            f"https://www.linkedin.com/jobs/search/?keywords={role}&location={location}"
        ],
        "count": 100,
        "scrapeCompany": False,
    }

    run = client.actor(
        "curious_coder/linkedin-jobs-scraper"
    ).call(run_input=run_input)

    dataset_id = run["defaultDatasetId"]

    jobs = []
    for item in client.dataset(dataset_id).iterate_items():
        jobs.append({
            "title": item.get("title"),
            "company": item.get("companyName"),
            "location": item.get("location"),
            "url": item.get("link"),
        })
    print(jobs)
    return jobs


####### TOOLS ###########
def job_chat(state):
    system = """
    You are a job search assistant.
    If the user asks to search jobs, call Linkedin_Job_Scraper.
    Extract:
    - role
    - location from the user
    """
    state["job_mode"] = True
    messages = [HumanMessage(content=system)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response],
            "intent": "job_chat"}


linkedinScraper = StructuredTool.from_function(
    name="Linkedin_Job_Scraper",
    func=fetch_linkedin_jobs,
    description="It helps in Scraping Jobs from Linkedin and Provide Necessary Details you must give ",
    args_schema=Input
)
tools = [linkedinScraper]
llm_with_tools = llm.bind_tools(tools)


## AI Response
def chat(state):
    system = """
    You are a helpful assistant.
    If the user is casually chatting, respond normally.
    If the user clearly asks to search jobs, respond naturally.
    Do NOT call any tools unless explicitly required.
    """
    response = llm.invoke(state["messages"] + [HumanMessage(content=system)])
    return {
        "messages": [response]
    }


#### Formatting the Jobs
def format_jobs(state):
    jobs = None

    for msg in reversed(state["messages"]):
        if isinstance(msg, ToolMessage):
            jobs = json.loads(msg.content)
            break

    if not jobs:
        return {
            "messages": [AIMessage(content="❌ No valid job data received.")]
        }

    text = "### 🔍 Job Results\n\n"

    for i, job in enumerate(jobs[:5], 1):
        text += (
            f"{i}. **{job.get('title')}**\n"
            f"   Company: {job.get('company')}\n"
            f"   Location: {job.get('location')}\n"
            f"   Link: {job.get('url')}\n\n"
        )
    state["job_mode"] = False
    return {"messages": [AIMessage(content=text)],
            "jobs": [AIMessage(content=text)]}


######## ROUTER ##########
from langchain_core.messages import HumanMessage


def Router(state: State):
    # get last HUMAN message
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            text = _message_to_text(msg.content).strip().lower()
            break
    else:
        return "chat"

    print("[router] text:", text)
    if state.get("pdf_input", False):
        return "resume"
    if "resume" in text:
        print("Router-Resume called")
        return "resume"

    if state.get("resume", False) or state.get("intent") == "resume":
        print("Router-Resume called")
        return "resume"

    if state.get("job_mode", False) or state.get("intent") == "job_chat":
        return "job_chat"

    if "job" in text or "search" in text:
        print("Router-Job is called")
        return "job_chat"
    print("Router-Chat is Called")
    return "chat"


############ NODE #############
graph_state = StateGraph(State)
graph_state.add_node("chat", chat)
graph_state.add_node("job_chat", job_chat)
graph_state.add_node("tools", ToolNode(tools=tools))
graph_state.add_node("resume", resume)
graph_state.add_node("format_jobs", format_jobs)


############# EDGES ############
graph_state.add_conditional_edges(START,
                    Router, {
            "resume": "resume",
            "chat": "chat",
            "job_chat": "job_chat",
                        }
            )
# graph_state.add_edge("tools", Router)
# graph_state.add_edge("resume", Router)
graph_state.add_conditional_edges("job_chat", tools_condition)
graph_state.add_edge("tools", "format_jobs")
graph_state.add_edge("format_jobs", END)
graph_state.add_edge("chat", END)
graph_state.add_edge("resume", END)
g = graph_state.compile(checkpointer=memory)

session_ids = {}


####### GRADIO SETUP ##################
def chatbot(user_input, history, resume_pdf=None, session_id=None):
    messages = []
    pdf_text = ""
    thread_id = session_id
    if resume_pdf is not None:
        pdf_text = extract_text_from_pdf(resume_pdf)
        if not pdf_text.strip():
            return (
                "I received your PDF, but I couldn't extract any text from it. "
                "It may be a scanned/image-based PDF. Please upload a text-based resume PDF or paste your resume text.",
                None,
            )
        messages.append(
            HumanMessage(
                content=f"Here is my resume content:\n{pdf_text}"
            )
        )
    if user_input:
        message = (HumanMessage(content=user_input))
        messages.append(message)
        result = g.invoke(
            {"messages": messages,
             "pdf_input_text": pdf_text if pdf_text else "",
             "pdf_input": True if resume_pdf is not None else False
             },
            config={
                "configurable": {
                    "thread_id": thread_id,

                }}
        )
        last_msg = result["messages"][-1]
    else:
        last_msg = AIMessage(content="")
        result = {"pdf": None}

    if isinstance(last_msg, (AIMessage, HumanMessage)):
        reply = _message_to_text(last_msg.content)
    elif isinstance(last_msg, dict):
        reply = last_msg.get("content", "")
    else:
        reply = str(last_msg)
    pdf_file = result.get("pdf", None)
    return reply, pdf_file


with gr.Blocks() as demo:
    chatbot_ui = gr.Chatbot()
    session_state = gr.State(str(uuid.uuid4()))
    with gr.Row():
        txt = gr.Textbox(
            placeholder="Type your message here...",
            show_label=False
        )
        pdf_input = gr.File(
            label="Upload Resume PDF",
            file_types=[".pdf"]
        )

    pdf_output = gr.File(label="Download Resume PDF")

    def respond(message, history, pdf, session_id):
        reply, pdf_file = chatbot(message, history, pdf, session_id)
        safe_reply = reply if isinstance(reply, str) else ""

        history.append({"role": "user", "content": str(message)})
        history.append({"role": "assistant", "content": safe_reply})

        return history, "", None, pdf_file, session_id

    txt.submit(
        respond,
        inputs=[txt, chatbot_ui, pdf_input, session_state],
        outputs=[chatbot_ui, txt, pdf_input, pdf_output, session_state]
    )


app = FastAPI(title="ResumeAI Python Backend")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

allowed_origins = (os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    .split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/chat")
async def chat_api(
    message: str = Form(...),
    history: str | None = Form(None),
    sessionId: str | None = Form(None),
    resume: UploadFile | None = File(None),
):
    if not message.strip():
        return JSONResponse(status_code=400, content={"success": False, "error": "Message is required."})

    pdf_buffer = None
    if resume is not None:
        if resume.content_type not in {"application/pdf", "application/octet-stream"}:
            return JSONResponse(status_code=400, content={"success": False, "error": "Only PDF files allowed"})
        pdf_buffer = io.BytesIO(await resume.read())

    try:
        reply, pdf_file = chatbot(message, history, pdf_buffer, sessionId or str(uuid.uuid4()))
    except Exception as exc:
        return JSONResponse(status_code=500, content={"success": False, "error": str(exc)})

    pdf_payload = None
    if pdf_file:
        pdf_payload = {
            "name": pdf_file,
            "url": f"/api/files/{pdf_file}"
        }

    return {
        "success": True,
        "reply": reply,
        "pdf": pdf_payload,
        "sessionId": sessionId,
    }


@app.get("/", response_class=HTMLResponse)
async def root():
    return f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ResumeAI Backend</title>
        <style>
          body {{
            font-family: Arial, Helvetica, sans-serif;
            background: #0f172a;
            color: #e5e7eb;
            margin: 0;
            padding: 40px 20px;
          }}
          .card {{
            max-width: 720px;
            margin: 0 auto;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 16px;
            padding: 24px;
          }}
          a {{
            color: #93c5fd;
          }}
          code {{
            background: #1f2937;
            padding: 2px 6px;
            border-radius: 6px;
          }}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>ResumeAI Backend is running</h1>
          <p>This server is the API layer, not the main website UI.</p>
          <p>Open the frontend at <a href="{FRONTEND_URL}">{FRONTEND_URL}</a>.</p>
          <p>API health check: <a href="/api/health">/api/health</a></p>
          <p>Chat endpoint: <code>POST /api/chat</code></p>
        </div>
      </body>
    </html>
    """


@app.get("/api/files/{filename}")
async def get_generated_pdf(filename: str):
    file_path = (GENERATED_DIR / filename).resolve()
    if GENERATED_DIR.resolve() not in file_path.parents:
        return JSONResponse(status_code=400, content={"success": False, "error": "Invalid file path."})
    if not file_path.exists():
        return JSONResponse(status_code=404, content={"success": False, "error": "File not found."})
    return FileResponse(file_path, media_type="application/pdf", filename=file_path.name)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "backend": "python-langgraph"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", "3001")))
