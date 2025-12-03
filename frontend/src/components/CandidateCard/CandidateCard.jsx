import './CandidateCard.css';
import upSeal from "../../assets/UP-Seal.png"

export default function CandidateCard({
    image, 
    studentName, 
    studentNumber, 
    studentAlias, 
    studentParty, 
    studentPosition, 
    studentDescription, 
    children, 
    className, 
    onView,
    isSelected,
    onSelect,
    multiple = false, //for councilors
    showSelect = true, 
    showView = true
    }){

    return (
            <div className={`candidate-card ${className || ''}`}>
                <div className='candidate-info-container'>
                    <img className="candidate-image" src={image || upSeal} alt="candidate Image" />
                    <div className='candidate-info'>
                        <div className='name'><strong>Name:</strong> {studentName}</div>
                        {/* <div className='student-number'>Student Number: {studentNumber}</div> */}
                        <div className='alias'><strong>Alias:</strong> {studentAlias}</div>
                        <div className='party'><strong>Party:</strong> {studentParty}</div>
                        <div className='position'><strong>Running For:</strong> {studentPosition}</div>
                        <div className='description'><strong>Candidate's Description:</strong> {studentDescription}</div>

                        {showView && <button className='view-details-button' onClick={onView}>View</button>}
                    </div>
                </div>
                {
                    showSelect && (
                        <div className="candidate-select">
                            {multiple ? (
                                <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={onSelect}
                                />
                            ) : (
                                <input
                                    type="radio" 
                                    checked={isSelected}
                                    onChange={onSelect}
                                />
                            )}
                        </div>
                    )
                }
                
                {children}

        </div>
    );
}