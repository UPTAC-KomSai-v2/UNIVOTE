import './CandidateCard.css';
import upSeal from "../../assets/UP-Seal.png"

export default function CandidateCard({image, studentName, studentNumber, studentAlias, studentParty, studentPosition, studentDescription, children, className}){

    return (
            <div className={`candidate-card ${className || ''}`}>
                <div className='candidate-info-container'>
                    <img className="candidate-image" src={image || upSeal} alt="candidate Image" />
                    <div className='candidate-info'>
                        <div className='name'>Name: {studentName}</div>
                        <div className='student-number'>Student Number: {studentNumber}</div>
                        <div className='alias'>Alias: {studentAlias}</div>
                        <div className='party'>Party: {studentParty}</div>
                        <div className='position'>Running For: {studentPosition}</div>
                        <div className='description'>Candidate's Description: {studentDescription}</div>
                    </div>
                </div>
                {children}

        </div>
    );
}