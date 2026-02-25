const pdfUpload=document.getElementById("pdfUpload");
const uploadStatus=document.getElementById("uploadStatus");
const quizCard=document.getElementById("quizCard");
const flashSection=document.getElementById("flashSection");
const resultCard=document.getElementById("resultCard");
const modeSwitch=document.getElementById("modeSwitch");

const questionText=document.getElementById("questionText");
const optionsContainer=document.getElementById("optionsContainer");
const nextBtn=document.getElementById("nextBtn");
const questionNumber=document.getElementById("questionNumber");
const timerText=document.getElementById("timerText");
const progressFill=document.getElementById("progressFill");

const flashFront=document.getElementById("flashFront");
const flashBack=document.getElementById("flashBack");
const flashcard=document.getElementById("flashcard");
const nextFlash=document.getElementById("nextFlash");

const finalScore=document.getElementById("finalScore");
const heatmapContainer=document.getElementById("heatmapContainer");
const reviewSection=document.getElementById("reviewSection");

const retryWrong=document.getElementById("retryWrong");
const restartAll=document.getElementById("restartAll");

const correctSound=document.getElementById("correctSound");
const wrongSound=document.getElementById("wrongSound");

let questions=[],wrongQuestions=[],reviewData=[];
let currentIndex=0,score=0,timeLeft=15,timer;
let sectionStats={};

// r=38, circumference = 2*PI*38 = 238.76
const CIRCUMFERENCE = 238.76;

pdfjsLib.GlobalWorkerOptions.workerSrc=
"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

pdfUpload.addEventListener("change",async function(){
const file=this.files[0];if(!file)return;
uploadStatus.innerText="⏳ Processing...";
const reader=new FileReader();
reader.onload=async function(){
const pdf=await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
let text="";
for(let i=1;i<=pdf.numPages;i++){
const page=await pdf.getPage(i);
const content=await page.getTextContent();
text+=content.items.map(it=>it.str).join(" ")+" ";
}
generateQuestions(text);
uploadStatus.innerText="✅ Ready — choose your mode below!";
modeSwitch.classList.remove("hidden");
};
reader.readAsArrayBuffer(file);
});

function generateQuestions(text){
questions=[];wrongQuestions=[];reviewData=[];sectionStats={};
const sentences=text.split(/[.?!]/).filter(s=>s.length>50).slice(0,8);
sentences.forEach((s,i)=>{
let words=s.split(" ").filter(w=>w.length>4);
const ans=words[Math.floor(words.length/2)];
const section="Section "+(Math.floor(i/2)+1);
if(!sectionStats[section])sectionStats[section]={correct:0,total:0};
sectionStats[section].total++;
questions.push({
question:s.replace(ans,"______"),
answer:ans,
section:section,
options:shuffle([ans,...shuffle(words).slice(0,3)])
});
});
}

document.getElementById("quizModeBtn").onclick=()=>{
modeSwitch.classList.add("hidden");
quizCard.classList.remove("hidden");
showQuestion();
};

document.getElementById("flashModeBtn").onclick=()=>{
modeSwitch.classList.add("hidden");
flashSection.classList.remove("hidden");
showFlashcard();
};

function showQuestion(){
if(currentIndex>=questions.length)return showResults();
const q=questions[currentIndex];
questionText.innerText=q.question;
questionNumber.innerText=`Question ${currentIndex+1} of ${questions.length}`;
optionsContainer.innerHTML="";
q.options.forEach((opt,i)=>{
const btn=document.createElement("button");
btn.innerText=`${i+1}.  ${opt}`;
btn.classList.add("option-btn");
btn.onclick=()=>checkAnswer(opt);
optionsContainer.appendChild(btn);
});
updateProgress();
startTimer();
}

function startTimer(){
timeLeft=15;
updateCircle();
clearInterval(timer);
timer=setInterval(()=>{
timeLeft--;
updateCircle();
if(timeLeft<=0){
clearInterval(timer);
wrongQuestions.push(questions[currentIndex]);
reviewData.push({q:questions[currentIndex],selected:"⏰ Time Up"});
currentIndex++;showQuestion();
}
},1000);
}

function updateCircle(){
timerText.innerText=timeLeft;
const circle=document.querySelector(".progress-ring-circle");
const offset=CIRCUMFERENCE-(CIRCUMFERENCE*(timeLeft/15));
circle.style.strokeDashoffset=offset;
// Color feedback
if(timeLeft<=5) circle.style.stroke="#f87171";
else if(timeLeft<=10) circle.style.stroke="#fbbf24";
else circle.style.stroke="#a78bfa";
}

function updateProgress(){
progressFill.style.width=((currentIndex/questions.length)*100)+"%";
}

function checkAnswer(selected){
clearInterval(timer);
const q=questions[currentIndex];
if(selected===q.answer){
score++;sectionStats[q.section].correct++;
correctSound.play();
reviewData.push({q:q,selected:selected});
}else{
wrongSound.play();
wrongQuestions.push(q);
reviewData.push({q:q,selected:selected});
}
currentIndex++;showQuestion();
}

function showFlashcard(){
if(currentIndex>=questions.length)return;
flashFront.innerText=questions[currentIndex].question;
flashBack.innerText=questions[currentIndex].answer;
flashcard.onclick=()=>flashcard.classList.toggle("flip");
}

nextFlash.onclick=()=>{
currentIndex++;flashcard.classList.remove("flip");showFlashcard();
};

function showResults(){
quizCard.classList.add("hidden");
resultCard.classList.remove("hidden");
finalScore.innerText=`Score: ${score} / ${questions.length}`;
generateHeatmap();
generateReview();
}

function generateHeatmap(){
heatmapContainer.innerHTML="";
for(let sec in sectionStats){
const {correct,total}=sectionStats[sec];
const percent=Math.round((correct/total)*100);
const box=document.createElement("div");
box.classList.add("heat-box");
box.innerText=`${sec}  ${percent}%`;
if(percent>=80)box.style.background="rgba(34,197,94,0.4)";
else if(percent>=50)box.style.background="rgba(251,146,60,0.4)";
else box.style.background="rgba(248,113,113,0.4)";
heatmapContainer.appendChild(box);
}
}

function generateReview(){
reviewSection.innerHTML="<h3>Detailed Review</h3>";
reviewData.forEach((item,i)=>{
const div=document.createElement("div");
div.style.margin="10px";
const correct=item.selected===item.q.answer;
div.innerHTML=`<strong style="color:${correct?'#4ade80':'#f87171'}">Q${i+1}:</strong> ${item.q.question}<br>
<span style="color:#9990b8">Your Answer:</span> ${item.selected}<br>
<span style="color:#9990b8">Correct:</span> ${item.q.answer}<hr style="border-color:rgba(255,255,255,0.06);margin-top:8px">`;
reviewSection.appendChild(div);
});
}

retryWrong.onclick=()=>{
if(wrongQuestions.length===0)return;
questions=[...wrongQuestions];
wrongQuestions=[];
currentIndex=0;score=0;
resultCard.classList.add("hidden");
quizCard.classList.remove("hidden");
showQuestion();
};

restartAll.onclick=()=>location.reload();

function shuffle(arr){
return arr.sort(()=>Math.random()-0.5);
}
