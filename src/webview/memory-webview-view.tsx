/********************************************************************************
 * Copyright (C) 2022 Ericsson, Arm and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import 'primeflex/primeflex.css';
import { PrimeReactProvider } from 'primereact/api';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryWidget } from './components/memory-widget';
import { MemoryAppProvider } from './components/memory-app-provider';

const App = () => (
    <MemoryAppProvider>
        <PrimeReactProvider>
            <MemoryWidget />
        </PrimeReactProvider>
    </MemoryAppProvider>
);

const container = document.getElementById('root') as Element;
createRoot(container).render(<App />);
