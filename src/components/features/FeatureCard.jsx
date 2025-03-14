import React from "react";
import { useNavigate } from "react-router-dom";

function FeatureCard(props) {
  const navigate = useNavigate();

  function handleClick(id) {
    switch(id) {
      case 0:
        navigate('/create-vault');
        break;
      case 1:
        navigate('/vault-manager');
        break;
      case 2:
        navigate("/security-center");
        break;
      case 3:
        navigate('/activity-log');
        break;
      default:
        console.log(id);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{props.title}</h3>
        <p className="card-description">{props.description}</p>
      </div>
      <div className="card-content">
        <p className="card-text">{props.content}</p>
        <button
          className="button button-primary"
          onClick={() => handleClick(props.id)}
        >
          {props.actionText}
        </button>
      </div>
    </div>
  );
}

export default FeatureCard;
