import styled from "styled-components";

const StyledEpub = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 40px;

  nav {
    align-items: center;
    background: #e7e0d4;
    display: flex;
    gap: 8px;
    justify-content: center;
    min-height: 44px;
    padding: 4px 8px;
  }

  nav span {
    flex: 1;
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  iframe {
    background: #fff;
    border: 0;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .message {
    align-items: center;
    color: #333;
    display: flex;
    flex: 1;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }
`;

export default StyledEpub;
