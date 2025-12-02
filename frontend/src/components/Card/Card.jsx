import React from "react";
import './Card.css';
import upSeal from "../../assets/UP-Seal.png"

export default function Card({title, description, children, className}){
    return (
        <div className={`card ${className || ''}`}>
            <div className="logo">
                <img src={upSeal} alt="UP Seal" />
                <div className="logo-text">
                    <p>
                        University of the Philippines
                    </p>
                    <p>
                        TACLOBAN COLLEGE
                    </p>
                </div>
            </div>
            <div className="card-content">
                <div className="card-title">{title}</div>
                <div className="card-description">{description}</div>
                {children}
            </div>
        </div>
    );
}