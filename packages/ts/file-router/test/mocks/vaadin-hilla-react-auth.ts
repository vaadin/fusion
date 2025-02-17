import sinon from 'sinon';

export const protectRoute: sinon.SinonStub = sinon.stub().callsFake((route) => route);
