import './CandidateCard.css';
import frontArrow from "../../assets/arrow-front.png"
import backArrow from "../../assets/arrow-back.png"


export default function CandidateCard({title, description, children, className}){

    return (
        <div className={`candidate-card ${className || ''}`}>
            <button className='change-candidate-button-back'>
                <img src={backArrow} alt="Back" />
            </button>
            {children}
        </div>
    );
}